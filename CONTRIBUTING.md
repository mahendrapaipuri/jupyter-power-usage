# Contributing

Contributions to jupyter-power-usage are highly welcome! It follows closely the [Jupyter contributor guide](https://docs.jupyter.org/en/latest/contributing/content-contributor.html).

## Setting up a development environment

We recommend using [pipenv](https://docs.pipenv.org/) to make development easier.

Alternatively, you can also use `conda` or `mamba` to create new virtual environments.

Clone the git repository:

```bash
git clone https://github.com/mahendrapaipuri/jupyter-power-usage
```

Create an environment that will hold our dependencies:

```bash
cd jupyter-power-usage
pipenv --python 3.8
```

With conda:

```bash
conda create -n jupyter-power-usage -c conda-forge python
```

Activate the virtual environment that pipenv created for us

```bash
pipenv shell
```

With conda:

```bash
conda activate jupyter-power-usage
```

Do a dev install of jupyter-power-usage and its dependencies

```bash
pip install --editable '.[dev]'
```

## JupyterLab extension

The JupyterLab extension for `jupyter-power-usage` follows the common patterns and tooling for developing extensions.

```bash
# activate the environment (conda, pipenv)

# install the package in development mode
python -m pip install -e ".[dev]"

# link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite

# Rebuild extension Typescript source after making changes
jlpm run build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm run watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

To check the extension is correctly installed, run:

```bash
jupyter labextension list
```

It should show something like the following:

```bash
JupyterLab v3.6.6
/path/to/env/share/jupyter/labextensions
        @mahendrapaipuri/jupyter-power-usage v0.1.0 enabled OK
```

## Estimating emission factor

Currently only French real time emission factor is implemented in the extension to estimation eCO<sub>2</sub> emissions based on power usage. For the rest of the countries a constant emission factor that can be configurable is used.

API requests for the emission factor is made from the frontend extension rather than backend server. The rationale is that the machine where backend server is running might not have internet connectivity. Also, these sort of API requests are rate limited and hence, making requests from individual user browser is more appropriate.

In order to add support for other countries, users need to make changes in the file [emissionsHandler.ts](./src/emissionsHandler.ts) as follows:

- Create a new namespace with name of the country.
- Add all the necessary logic to get the emission factor in g/kWh for the country in its namespace.
- Finally, modify `getEmissions` function in [emissionsHandler.ts](./src/emissionsHandler.ts) to get the emission factor of the country.

We need to add the country code in the enum section of `countryCode` object in [plugin.json](./schema/plugin.json). This enables users to use this country specific emission factor to estimate emissions.

## pre-commit

`jupyter-power-usage` has adopted automatic code formatting so you shouldn't need to worry too much about your code style.
As long as your code is valid,
the pre-commit hook should take care of how it should look. Here is how to set up pre-commit hooks for automatic code formatting, etc.

```bash
pre-commit install
```

You can also invoke the pre-commit hook manually at any time with

```bash
pre-commit run
```

which should run any autoformatting on your code
and tell you about any errors it couldn't fix automatically.
You may also install [black integration](https://github.com/ambv/black#editor-integration)
into your text editor to format code automatically.

If you have already committed files before setting up the pre-commit
hook with `pre-commit install`, you can fix everything up using
`pre-commit run --all-files`. You need to make the fixing commit
yourself after that.

## Tests

It's a good idea to write tests to exercise any new features,
or that trigger any bugs that you have fixed to catch regressions. `pytest` is used to run the test suite. You can run the tests with in the repo directory:

```bash
python -m pytest
```
