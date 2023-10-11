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
from jupyter_server.utils import url_path_join as ujoin

from ._version import __version__
from .api import PowerMetricHandler
from .config import PowerUsageDisplay
from .metrics import CpuPowerUsage
from .metrics import GpuPowerUsage


def _jupyter_labextension_paths():
    return [{"src": "labextension", "dest": "@mahendrapaipuri/jupyter-power-usage"}]


def load_jupyter_server_extension(server_app):
    """
    Called when the extension is loaded.

    Args:
        nbapp : handle to the Notebook webserver instance.
    """
    config = PowerUsageDisplay(parent=server_app)
    server_app.web_app.settings['jupyter_power_usage_config'] = config

    cpu_power_usage = CpuPowerUsage(server_app)
    gpu_power_usage = GpuPowerUsage(server_app)

    base_url = server_app.web_app.settings["base_url"]

    server_app.web_app.add_handlers(
        ".*$",
        [
            (
                ujoin(base_url, 'api/metrics/v1/power_usage'),
                PowerMetricHandler,
                {
                    'cpu_power_usage': cpu_power_usage,
                    'gpu_power_usage': gpu_power_usage,
                },
            ),
        ],
    )
