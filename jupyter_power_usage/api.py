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
import getpass
import json
from concurrent.futures import ThreadPoolExecutor

import psutil
from jupyter_server.base.handlers import JupyterHandler
from tornado import web
from tornado.concurrent import run_on_executor


class PowerMetricHandler(JupyterHandler):
    executor = ThreadPoolExecutor(max_workers=5)

    def initialize(self, cpu_power_usage, gpu_power_usage):
        self.cpu_power_usage = cpu_power_usage
        self.gpu_power_usage = gpu_power_usage

        # Check if CPU and/or GPU power usages are available
        self.cpu_power_usage_available = self.cpu_power_usage.power_usage_available()
        self.gpu_power_usage_available = self.gpu_power_usage.power_usage_available()

        # Get CPU power limit if metrics are available
        if self.cpu_power_usage_available:
            self.cpu_power_limit = self.cpu_power_usage.get_power_limit()

        # Get GPU power limit if metrics are available
        if self.gpu_power_usage_available:
            self.gpu_power_limit = self.gpu_power_usage.get_power_limit()

        # Get reporting scope from config
        self.measurement_scope = self.settings[
            'jupyter_power_usage_config'
        ].measurement_scope

        # Get current user
        self.user = getpass.getuser()

    @web.authenticated
    async def get(self):
        """Return host and user energy usage"""
        # Set process list based on measurement_scope
        if self.measurement_scope == 'process':
            pids = [psutil.Process().pid] + [
                p.pid for p in psutil.Process().children(recursive=True)
            ]
        elif self.measurement_scope == 'user':
            pids = [
                p.pid
                for p in psutil.process_iter(['pid', 'username'])
                if p.username() == self.user
            ]
        else:
            # No need to pass any PIDs. CPU and memory shares will be always 1
            pids = []

        metrics = {}

        # Add CPU metrics to payload if available
        if self.cpu_power_usage_available:
            cpu_power_usage = await self._get_cpu_energy_usage(pids)
            metrics.update(
                {'cpu': {'usage': cpu_power_usage, 'limit': self.cpu_power_limit}}
            )

        # Add GPU metrics to payload if available
        if self.gpu_power_usage_available:
            gpu_power_usage = self.gpu_power_usage.get_power_usage()
            metrics.update(
                {
                    'gpu': {
                        'usage': gpu_power_usage,
                        'limit': self.gpu_power_limit,
                    }
                }
            )

        # Get GPU usage
        self.finish(json.dumps(metrics))

    @run_on_executor
    def _get_cpu_energy_usage(self, all_processes):
        return self.cpu_power_usage.get_power_usage(all_processes)
