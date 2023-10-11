# jupyterlab-topbar-message

A banner message to display on the Jupyterlab Topbar. It is similar to [jupyterlab-topbar-text](https://github.com/jupyterlab-contrib/jupyterlab-topbar-text) project. The difference is that the message is immutable and it can be set in the backend server.

It is mostly useful if the sysadmins want to disply a specific message to the users while spawning the JupyterLab servers using JupyterHub. They can implement the logic in the spawner and needs to set a environment variable `JUPYTERLAB_TOPBAR_MESSAGE` in the spawner environment.

For instance, it can be as simple as adding a welcome message to a user, `bob` as `JUPYEERLAB_TOPBAR_MESSAGE="Welcome Bob"`.

## Requirements

- JupyterLab >= 3.0

## Install

```bash
pip install git+https://gitlab.com/idris-cnrs/jupyter/jupyterlab/jupyterlab-topbar.git#subdirectory=packages/message-extension
```

## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the jupyterlab-toolbar-buttons directory
# Install package in development mode
pip install -e .
# Link your development version of the extension with JupyterLab
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

By default, the `jlpm run build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Uninstall

```bash
pip uninstall jupyterlab_topbar_message
```
