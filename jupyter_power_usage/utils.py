# Copyright 2023 IDRIS / jupyter
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
import os
import re
import subprocess

# RAPL powercap API directory
RAPL_API_DIR = '/sys/class/powercap/intel-rapl'

# Maximum number of RAPL domains
# pkg, core, uncore, dram, psys
# Seems like psys is TOTAL consumption but not available on all chips
# Ref: https://github.com/powercap/powercap/issues/3
NUM_RAPL_DOMAINS = 5


def execute_cmd(cmd):
    """Accept command string and returns output. If command fails, returns None"""
    try:
        # Execute command
        completed = subprocess.run(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=True
        )
        # Get stdout and stderr. We are piping stderr to stdout as well
        return completed.stdout.decode('utf-8').rstrip()
    except subprocess.CalledProcessError:
        return None


def get_num_sockets():
    """Gets number of processors"""
    # Get output from lscpu command
    cmd_out = execute_cmd('lscpu')

    if cmd_out is None:
        # If command fails, return 1 socket as default
        return 1

    # Get number of sockets present in the processor
    sockets = re.search(r'Socket\(s\):\s*([\d])', cmd_out, re.M)
    if sockets:
        return int(sockets.group(1))
    else:
        return 1


def get_all_available_rapl_domains():
    """Gets all the packages, core, uncore and dram domains available within RAPL
    powercap interface"""

    # Get number of sockets present in the processor
    # psys will be a separate domain so check for num_sockets + 1
    num_sockets = get_num_sockets() + 1

    # Dict with package and domain names and paths
    rapl_domains = {'packages': {}}

    # Check available devices for each socket
    for i_soc in range(num_sockets):
        package_path = os.path.join(RAPL_API_DIR, 'intel-rapl:{}'.format(i_soc))
        # If path not found, ignore
        if not os.path.exists(package_path):
            continue

        with open(os.path.join(package_path, 'name'), 'r') as pkg_name:
            package_name = pkg_name.readline().rstrip('\n')

        # A Dict of paths to energy_uj and max_energy_uj counter files
        rapl_domains['packages'][package_name] = {
            'energy_uj': os.path.join(package_path, 'energy_uj'),
        }

        for i_dom in range(NUM_RAPL_DOMAINS):
            domain_path = os.path.join(
                package_path, 'intel-rapl:{}:{}'.format(i_soc, i_dom)
            )
            if not os.path.exists(domain_path):
                continue

            with open(os.path.join(domain_path, 'name'), 'r') as dom_name:
                domain_name = dom_name.readline().rstrip('\n')

            rapl_domains['packages'][package_name]['domains'] = {
                domain_name: {
                    'energy_uj': os.path.join(domain_path, 'energy_uj'),
                }
            }

    return rapl_domains


def read_max_energy_uj_counter(path):
    """Utility function that takes energy_uj path and return overflow counter for that
    energy counter"""
    return int(
        open(path.replace('energy_uj', 'max_energy_range_uj'), 'r').read().rstrip('\n')
    )


def read_power_limit_uw_counter(path):
    """Utility function that takes energy_uj path and return overflow counter for that
    energy counter

    Usually constraint_1_power_limit_uw is the short term power limit constraint and
    so we choose it as we update power usage every 5 sec by default.

    If constraint_1_power_limit_uw is not there, check for constraint_0_power_limit_uw
    which is long term
    """
    for constraint in ('constraint_1_power_limit_uw', 'constraint_0_power_limit_uw'):
        power_limit_path = path.replace('energy_uj', constraint)

        # Check if constraint_1_power_limit_uw file exists. There is no guarantee that
        # it exists on all systems. If it exists return value
        if os.path.exists(power_limit_path):
            return int(open(power_limit_path, 'r').read().rstrip('\n'))

    # If neither of them exists, return 0
    return 0


def filter_rapl_domains():
    """From all available RAPL domains, filter the ones that are relevant for energy
    consumption calculation and return it as flattened dict"""
    rapl_domains = get_all_available_rapl_domains()

    # Flattened dict of relevant RAPL packages and domains
    # and overflow counter values
    filtered_domains = {}
    filtered_domains_power_limits = {}
    filtered_domains_overflow_counters = {}

    # First check if psys is in packages. If exists, just return psys package as
    # filtered domain as it is supposed to contain total consumption
    #
    # NOTE: psys is still sort of a black hole and we dont know what it is reporting.
    # Moreover there is a very high chance that psys is not reported in server grade
    # chips. So, ignore psys for the moment.
    #
    # if 'psys' in rapl_domains['packages'].keys():
    #     path = rapl_domains['packages']['psys']['energy_uj']
    #     filtered_domains['psys'] = path

    #     # Read max_energy_uj overflow counter
    #     filtered_domains_overflow_counters['psys'] = read_max_energy_uj_counter(path)
    #     return filtered_domains, filtered_domains_overflow_counters

    for pkg_name, pkg_dict in rapl_domains['packages'].items():
        filtered_domains[pkg_name] = pkg_dict['energy_uj']
        filtered_domains_power_limits[pkg_name] = read_power_limit_uw_counter(
            pkg_dict['energy_uj']
        )
        filtered_domains_overflow_counters[pkg_name] = read_max_energy_uj_counter(
            pkg_dict['energy_uj']
        )

        if 'domains' not in pkg_dict.keys():
            continue

        for dom_name, dom_dict in pkg_dict['domains'].items():
            # Only DRAM domain is not included in package counters. We can safely
            # ignore rest of the domains
            if dom_name != 'dram':
                continue

            unq_dom_name = f'{dom_name}-{pkg_name}'
            filtered_domains[unq_dom_name] = dom_dict['energy_uj']
            filtered_domains_power_limits[unq_dom_name] = read_power_limit_uw_counter(
                dom_dict['energy_uj']
            )
            filtered_domains_overflow_counters[
                unq_dom_name
            ] = read_max_energy_uj_counter(dom_dict['energy_uj'])
    return (
        filtered_domains,
        filtered_domains_power_limits,
        filtered_domains_overflow_counters,
    )


if __name__ == '__main__':
    import json

    rapl_domains = get_all_available_rapl_domains()
    print(json.dumps(rapl_domains, indent=2))

    domains, power_limits, ovflw_count = filter_rapl_domains()
    print(json.dumps(domains, indent=2))
    print(json.dumps(power_limits, indent=2))
    print(json.dumps(ovflw_count, indent=2))
