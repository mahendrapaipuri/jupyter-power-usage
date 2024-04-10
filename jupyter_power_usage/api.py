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
from jupyter_server.utils import url_escape
from jupyter_server.utils import url_path_join
from tornado import web
from tornado.concurrent import run_on_executor
from tornado.httpclient import AsyncHTTPClient
from tornado.httpclient import HTTPError
from tornado.httpclient import HTTPRequest
from tornado.httputil import url_concat


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


class ElectrictyMapsHandler(JupyterHandler):
    """
    A proxy for the Electricity Maps API v3.

    The purpose of this proxy is to provide authentication to the API requests.
    """

    # Force a new instance to not to mess up with other instances that might exist in
    # JupyterHub or other Jupyter related stacks
    #
    # Without this we noticed that JupyterHub will fail to spawn instances when internal
    # TLS is on. The reason is that this new instantiation will override the already
    # existing instance in single user extension that has SSL context configured. So
    # we lose SSL context and hence cert verification will fail eventually failing spawn.
    client = AsyncHTTPClient(force_instance=True)

    def initialize(self):
        # Get access token(s) from config
        self.access_tokens = {}
        self.access_tokens['emaps'] = self.settings[
            'jupyter_power_usage_config'
        ].emaps_access_token

    @web.authenticated
    async def get(self, path):
        """Return emission factor data from electricity maps"""
        try:
            query = self.request.query_arguments
            params = {key: query[key][0].decode() for key in query}
            api_path = url_path_join('https://api.electricitymap.org', url_escape(path))

            access_token = params.pop('access_token', None)
            if self.access_tokens['emaps']:
                # Preferentially use the config access_token if set
                token = self.access_tokens['emaps']
            elif access_token:
                token = access_token
            else:
                token = ''

            api_path = url_concat(api_path, params)

            request = HTTPRequest(
                api_path,
                user_agent='JupyterLab Power Usage',
                headers={'auth-token': f'{token}'},
            )
            response = await self.client.fetch(request)
            data = json.loads(response.body.decode('utf-8'))

            # Send the results back.
            self.finish(json.dumps(data))

        except HTTPError as err:
            self.set_status(err.code)
            message = err.response.body if err.response else str(err.code)
            self.finish(message)
