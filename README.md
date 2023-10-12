# jupyter-power-usage

![Github Actions Status](https://github.com/mahendrapaipuri/jupyter-power-usage/workflows/Tests/badge.svg)
[![PyPI](https://img.shields.io/pypi/v/jupyter-power-usage)](https://pypi.python.org/pypi/jupyter-power-usage)
[![PyPI](https://img.shields.io/pypi/l/jupyter-power-usage)](https://pypi.python.org/pypi/jupyter-power-usage)
[![GitHub](https://img.shields.io/badge/issue_tracking-github-blue?logo=github)](https://github.com/jupyter-server/jupyter-resource-usage/issues)

**Try the extension on**
[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/mahendrapaipuri/jupyter-power-usage/main)

![Screencast for power usage](https://raw.githubusercontent.com/mahendrapaipuri/jupyter-power-usage/main/doc/power-usage.gif)

The objective of this extension is to display power usage of the CPU and/or GPU on which jupyter server is running. Power usage is estimated using [Running Average Power Limit (RAPL)](https://web.eece.maine.edu/~vweaver/projects/rapl/) metrics that are available on Intel processors manufactured after 2012 (since broadwell). It is available on latest AMD processors as well. For the case of GPUs, currently only nVIDIA GPUs are supported and power usage is gathered from `nvidia-smi` tool.

Additionally, the extension is capable of estimating equivalent CO<sub>2</sub> emissions. Emissions are estimated based on the current power usage and a emission factor that gives equivalent grams of CO<sub>2</sub> power consumed. Currently, a [real time emission factor](https://www.rte-france.com/en/eco2mix/co2-emissions) is implemented for France and for the rest a constant configurable [factor](https://arxiv.org/pdf/2306.08323.pdf) of 475 gCO<sub>2</sub>.eq/kWh is used.

The metrics are displayed in the top bar of JupyterLab and are updated at a configurable interval. The default interval is 5 seconds. RAPL can enforce power limit so as nVIDIA GPUs. If those power limits are enabled and available, they will be displayed in the indicators.

---

**NOTE**

The extension works only on Linux that exposes RAPL metrics. Starting from kernel 5.4, RAPL metrics are accessible [only for root](https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux.git/commit/?h=v5.4.77&id=19f6d91bdad42200aac557a683c17b1f65ee6c94). In this case, the user needs to add read permissions on `/sys/fs/powercap` directory to be able to display power usage indicators in JupyterLab.

If the JupyterLab is running inside a container or VM, ensure that `/sys/fs/powercap` file system exists. If it does not, extension will not work.

The extension is not available for Notebook < 6. It supports JupyterLab >= 3 and Notebook >= 7.

The extension's architecture closes follows the [jupyter-resource-usage](https://github.com/jupyter-server/jupyter-resource-usage) extension and all the credit goes to the contributors and maintainers of the above stated extension.

---

## Installation

### JupyterLab 3.x

You should install the version `<1.0.0` for JupyterLab 3.x compatibility.

```bash
pip install 'jupyter-power-usage<1.0.0'
```

### JupyterLab 4.x and Notebook 7.x

You should install the latest version for JupyterLab 4.x and Notebook 7.x compatibility.

```bash
pip install jupyter-power-usage
```

The extension **does not support** Notebook < 7.

## Configuration

### Server side config

#### Measurement Scope

Currently the extension supports different measurement scopes:

- `process`: Power usage for current process and its children will be reported
- `user`: Power usage for current user processes will be reported
- `system`: Power usage for entire system will be reported.

By default `process` scope is used. The user can change it by CLI flag `--PowerUsageDisplay.measurement_scope` to `jupyter lab` command. Alternatively, it can be configured in `jupyter_server_config.json` in [Jupyter config directory](https://docs.jupyter.org/en/latest/use/jupyter-directories.html#configuration-files).

### Frontend extension config

![Frontend extension settings](https://raw.githubusercontent.com/mahendrapaipuri/jupyter-power-usage/main/doc/frontend-settings.png)

The frontend extension settings can be accessed by `Settings -> Advanced Settings -> Power Usage Monitor` in JupyterLab. Important settings are:

- `Refresh Rate`: Frequency at which power usage is updated in the JupyterLab. Do not use too small intervals as it will end up making too many API calls to update metrics.

- `CPU label` and `GPU label` settings are self explanatory.

**Emissions Estimation Settings**

- `Country code`: Currently only data for France is supported. The realtime emission factor from [RTE eCO<sub>2</sub> mix](https://www.rte-france.com/en/eco2mix/co2-emissions). We encourage users to add support for other countries. Please check [`CONTRIBUTING.md`](CONTRIBUTING.md) on how to do it. If your country is not available in the list, leave it blank.

- `Refresh rate`: This defines how often the emission factor is updated in ms. For [RTE eCO<sub>2</sub> mix](https://www.rte-france.com/en/eco2mix/co2-emissions) data, it is updated every 30 min and has a rate limit of 50000 API requests per month.

- `Emission factor`: This constant emission factor is used in the estimation of emissions when country specific data is unavailable.

## Contributing

If you would like to contribute to the project, please read the [`CONTRIBUTING.md`](CONTRIBUTING.md). The `CONTRIBUTING.md` file
explains how to set up a development installation and how to run the test suite.

## Uninstall

```bash
pip uninstall jupyter_power_usage
```

This will uninstall python package and all the frontend related assets.

## Troubleshooting

- If power indicators do not show up in the JupyterLab, try reload the browser tab.
  Sometimes network latencies prevent extension to load in time.

- If there are any issues with the server side extension, they will be logged to the
  same log that JupyterLab uses.
