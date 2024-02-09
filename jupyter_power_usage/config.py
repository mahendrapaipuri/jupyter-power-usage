from traitlets import Enum
from traitlets import Unicode
from traitlets.config import Configurable

# Minimum measurement period in millisec.
# Dont let users to use a period less than this minimum period
MIN_MEASUREMENT_PERIOD = 100


class PowerUsageDisplay(Configurable):
    """Server side config for jupyterlab-power-usage"""

    measurement_scope = Enum(
        ['process', 'user', 'sys'],
        default_value='process',
        help="""Scope of measurement. It can take one of three options:
        
        - `process`: Power usage for current process and its children will
          be reported
        - `user`: Power usage for current user processes will be reported
        - `system`: Power usage for entire system will be reported.

        By default only current process power usage will be reported.

        This is only applicable to CPU power usage. If GPU power usage is available,
        GPU level power usage is reported always.
        """,
    ).tag(config=True)

    emaps_access_token = Unicode(
        '', help="An API access token for Electricty Maps."
    ).tag(config=True)
