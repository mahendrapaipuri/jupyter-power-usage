from jupyter_server.utils import url_path_join as ujoin

from ._version import __version__  # noqa
from .api import ElectrictyMapsHandler
from .api import PowerMetricHandler
from .config import PowerUsageDisplay
from .metrics import CpuPowerUsage
from .metrics import GpuPowerUsage


def _jupyter_server_extension_points():
    return [{"module": "jupyter_power_usage"}]


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
            (
                ujoin(base_url, 'api/metrics/v1/emission_factor/emaps') + '(.*)',
                ElectrictyMapsHandler,
            ),
        ],
    )
