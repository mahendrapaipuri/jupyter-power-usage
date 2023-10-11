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
import re
import time

import psutil
from jupyter_server.serverapp import ServerApp
from py3nvml.py3nvml import nvmlDeviceGetCount
from py3nvml.py3nvml import nvmlDeviceGetEnforcedPowerLimit
from py3nvml.py3nvml import nvmlDeviceGetHandleByIndex
from py3nvml.py3nvml import nvmlDeviceGetPowerUsage
from py3nvml.py3nvml import NVMLError
from py3nvml.py3nvml import nvmlInit

from .utils import filter_rapl_domains

# Default power consumption for DRAM if counters are available
# Units in W/GB RAM consumed
# Source: https://arxiv.org/pdf/2306.08323.pdf
DEFAULT_DRAM_CONSUMPTION = 0.375


class CpuPowerUsage:
    """Extract CPU power usage using RAPL metrics"""

    def __init__(self, server_app: ServerApp):
        self.server_app = server_app
        self.config = server_app.web_app.settings['jupyter_power_usage_config']
        (
            self.rapl_domains,
            self.rapl_domain_power_limits,
            self.rapl_domain_overflow_counters,
        ) = filter_rapl_domains()
        self.rapl_domain_names = list(self.rapl_domains.keys())

        # Get total power limit
        self._power_limit = 0
        for pkg_name, pwr_limit in self.rapl_domain_power_limits.items():
            if re.search(r'package-[\d{1}]$', pkg_name):
                self._power_limit += pwr_limit

        # Convert micro Watts into Watts
        self._power_limit = self._power_limit / 1e6

        # Get a sample reading to check if metrics are available
        self._power_usage_available = False
        counters = self.get_rapl_counters()
        if sum(counters.values()) > 0:
            self._power_usage_available = True

            # Setup first readings
            self.rapl_readings_t = counters
            self.time_t = time.time()

    def power_usage_available(self):
        """Check if power metrics are available"""
        return self._power_usage_available

    def get_power_limit(self):
        """Get CPU power limit"""
        return self._power_limit

    @staticmethod
    def read_energy_counter(path):
        """Read energy counter file and return value"""
        try:
            content = open(path, 'r').read().rstrip()
            # Units are micro Joules
            return int(content)
        except (PermissionError, ValueError):
            return 0

    def get_rapl_counters(self):
        """Gets energy counters from RAPL powercap interface"""
        # Make a copy of dict and replace paths with values of energy counters
        rapl_counters = self.rapl_domains.copy()
        for k, v in self.rapl_domains.items():
            rapl_counters[k] = self.read_energy_counter(v)
        return rapl_counters

    def get_cpu_share(self, pids):
        """Get CPU share of processes based on defined scope"""
        # If system wide measurement is chosen we dont need to compute share
        # So return immediately with share as 1
        if self.config.measurement_scope == 'system':
            return 1, 1

        # CPU share is sum of all process's cpu percents
        cpu_share = sum(
            [psutil.Process(pid=p).cpu_percent(interval=0.05) / 100 for p in pids]
        )

        # Memory share if sum of all process's memory / total memory consumption
        # We choose RSS here to estimate the share. Sum of all RSS will be more than
        # the physical memory as we will add shared memory of all processes thus
        # deuplicating memory. But we are interested only in the fraction and it
        # seems to be a reasonable estimate
        mem_share = sum([psutil.Process(pid=p).memory_info().rss for p in pids]) / sum(
            [p.memory_info().rss for p in psutil.process_iter(['memory_info'])]
        )
        return cpu_share, mem_share

    def get_total_power_usage(self, period, counters):
        """Get power usage based on counters"""
        count_dt, count_t = counters

        pkg_total = 0
        dram_total = 0
        for dom in self.rapl_domain_names:
            diff = count_dt[dom] - count_t[dom]

            # If diff is less than 0, counters have overflown
            if diff < 0:
                diff += self.rapl_domain_overflow_counters[dom]

            if dom.startswith('dram'):
                dram_total += diff
            else:
                pkg_total += diff

        # Total CPU and DRAM power usage after converting mJ into Joules
        cpu_power_usage = pkg_total / 1e6 / period
        dram_power_usage = dram_total / 1e6 / period

        # Check if dram_usage is 0 and if it is zero return an estimate
        # by using DEFAULT_DRAM_CONSUMPTION
        if dram_power_usage == 0:
            # Used memory in GiB
            mem_used = (
                psutil.virtual_memory().percent
                * psutil.virtual_memory().total
                / (1024 * 1024 * 1024 * 100)
            )
            dram_power_usage = mem_used * DEFAULT_DRAM_CONSUMPTION

        return cpu_power_usage, dram_power_usage

    def get_power_usage(self, pids):
        """Get power usage by making two readings with a measurement interval"""
        # Make current measurements
        rapl_readings_dt = self.get_rapl_counters()
        current_time = time.time()

        # Power usage computed based on previous readings
        cpu_power_usage, dram_power_usage = self.get_total_power_usage(
            current_time - self.time_t, (rapl_readings_dt, self.rapl_readings_t)
        )
        # # For local testing
        # import random
        # cpu_power_usage = random.uniform(20, 30)
        # dram_power_usage = random.uniform(5, 10)
        cpu_share, mem_share = self.get_cpu_share(pids)

        # Set current measurements as previous measurements for next reading
        self.rapl_readings_t = rapl_readings_dt
        self.time_t = current_time

        return cpu_power_usage * cpu_share + dram_power_usage * mem_share


class GpuPowerUsage:
    """Extract nVIDIA GPU power usage using PyNVML lib"""

    def __init__(self, server_app: ServerApp):
        self.server_app = server_app
        self.config = server_app.web_app.settings['jupyter_power_usage_config']

        self._power_usage_available = True
        self._power_limit = 0

        # Initialise NVML
        try:
            nvmlInit()

            # Number of devices
            self.ngpus = nvmlDeviceGetCount()

            # Get total power limit in mW for all GPUs
            for i in range(self.ngpus):
                handle = nvmlDeviceGetHandleByIndex(i)
                self._power_limit += nvmlDeviceGetEnforcedPowerLimit(handle)
        except NVMLError as err:
            self.server_app.log.warning(
                'Could not initiliaze pynvm due to %s. '
                'GPU energy usage will not be reported...' % err
            )
            self._power_usage_available = False
            # self._power_limit = 100000

    def get_power_limit(self):
        """Get total power limit of all available GPUs in W"""
        return self._power_limit / 1e3

    def power_usage_available(self):
        """Checks if power usage metrics are available or not"""
        return self._power_usage_available

    def get_power_usage(self):
        """Get power usage of all available GPUs"""
        if not self._power_usage_available:
            return 0
        # else:
        #     import random
        #     gpu_power_usage = random.uniform(20, 50)
        #     return gpu_power_usage

        # Query power usage in mW for each GPU
        try:
            gpu_power_usage = 0
            for i in range(self.ngpus):
                handle = nvmlDeviceGetHandleByIndex(i)
                gpu_power_usage += nvmlDeviceGetPowerUsage(handle)
            return gpu_power_usage / 1e3
        except NVMLError as err:
            self.server_app.log.debug('Failed to get GPU power usage due to %s' % err)
            return 0


if __name__ == '__main__':
    cpu = CpuPowerUsage()
    print(cpu.get_power_usage())
