import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
} from '@jupyterlab/application';

import { IToolbarWidgetRegistry } from '@jupyterlab/apputils';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { JSONObject } from '@lumino/coreutils';

import { CpuPowerView } from './cpuPowerView';

import { GpuPowerView } from './gpuPowerView';

import { EmissionsView } from './emissionsView';

import { EmissionFactor, PowerUsage } from './model';

import '../style/index.css';

/**
 * The default refresh rate for RAPL metrics.
 */
const DEFAULT_RAPL_REFRESH_RATE = 5000;

/**
 * By default indicator bar is always enabled.
 */
const DEFAULT_INDICATOR_BAR_DISABLED = false;

/**
 * The default cpu power label.
 */
const DEFAULT_CPU_POWER_LABEL = 'CPU Power: ';

/**
 * The default gpu power label.
 */
const DEFAULT_GPU_POWER_LABEL = 'GPU Power: ';

/**
 * The default refresh rate for emissions.
 */
const DEFAULT_EMISSIONS_REFRESH_RATE = 1800000;

/**
 * The default country data to use for emissions calculation.
 */
const DEFAULT_COUNTRY_CODE = 'fr';

/**
 * The default emission factor to use in case on unavailable data
 */
const DEFAULT_EMISSION_FACTOR = 475;

/**
 * The default emission factor source
 */
const DEFAULT_EMISSION_FACTOR_SOURCE = 'rte';

/**
 * An interface for resource settings.
 */
interface IResourceSettings extends JSONObject {
  label: string;
}

/**
 * An interface for emissions settings.
 */
interface IEmissionsSettings extends JSONObject {
  source: string;
  emapsAccessToken: string;
  countryCode: string;
  refreshRate: number;
  factor: number;
}

/**
 * Initialization data for the jupyterlab-system-monitor extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: '@mahendrapaipuri/jupyter-power-usage:plugin',
  autoStart: true,
  requires: [IToolbarWidgetRegistry],
  optional: [ISettingRegistry],
  activate: async (
    app: JupyterFrontEnd,
    toolbarRegistry: IToolbarWidgetRegistry,
    settingRegistry: ISettingRegistry | null
  ) => {
    console.log('@mahendrapaipuri/jupyter-power-usage extension is activated');

    let refreshRate = DEFAULT_RAPL_REFRESH_RATE;
    let indicatorBarDisabled = DEFAULT_INDICATOR_BAR_DISABLED;
    let cpuPowerLabel = DEFAULT_CPU_POWER_LABEL;
    let gpuPowerLabel = DEFAULT_GPU_POWER_LABEL;
    let emissionsRefreshRate = DEFAULT_EMISSIONS_REFRESH_RATE;
    let emissionFactorSource = DEFAULT_EMISSION_FACTOR_SOURCE;
    let emapsAccessToken = '';
    let countryCode = DEFAULT_COUNTRY_CODE;
    let emissionFactor = DEFAULT_EMISSION_FACTOR;

    if (settingRegistry) {
      const settings = await settingRegistry.load(extension.id);
      refreshRate = settings.get('refreshRate').composite as number;
      if (refreshRate < DEFAULT_RAPL_REFRESH_RATE) {
        console.log(
          `Refresh rate is floored at ${DEFAULT_RAPL_REFRESH_RATE} ms`
        );
        refreshRate = DEFAULT_RAPL_REFRESH_RATE;
      }

      indicatorBarDisabled = settings.get('indicatorBarDisabled')
        .composite as boolean;

      const emissionsSettings = settings.get('emissions')
        .composite as IEmissionsSettings;
      emissionFactorSource = emissionsSettings.source;
      emapsAccessToken = emissionsSettings.emapsAccessToken;
      countryCode = emissionsSettings.countryCode;
      emissionsRefreshRate = emissionsSettings.refreshRate;
      emissionFactor = emissionsSettings.factor;
      if (emissionsRefreshRate < DEFAULT_EMISSIONS_REFRESH_RATE) {
        console.log(
          `Emissions update interval is floored at ${DEFAULT_EMISSIONS_REFRESH_RATE} ms`
        );
        emissionsRefreshRate = DEFAULT_EMISSIONS_REFRESH_RATE;
      }

      const cpuSettings = settings.get('cpu').composite as IResourceSettings;
      cpuPowerLabel = cpuSettings.label;
      const gpuSettings = settings.get('gpu').composite as IResourceSettings;
      gpuPowerLabel = gpuSettings.label;
    }

    const emissionsModel = new EmissionFactor.Model({
      refreshRate: emissionsRefreshRate,
      emissionFactorSource: emissionFactorSource,
      accessTokens: {
        emaps: emapsAccessToken,
      },
      countryCode: countryCode,
      defaultEmissionFactor: emissionFactor,
    });
    await emissionsModel.refresh();

    const model = new PowerUsage.Model(emissionsModel, { refreshRate });
    await model.refresh();

    // Dispose poll if none of the metrics are available
    if (!model.cpuPowerAvailable && !model.gpuPowerAvailable) {
      console.log('Power metrics are not available...');
      model.dispose();
      emissionsModel.dispose();
    }

    // Add cpu power usage panel if metrics are available
    if (model.cpuPowerAvailable) {
      toolbarRegistry.addFactory('TopBar', 'cpu_power', () => {
        const cpuPower = CpuPowerView.createPowerView(
          model,
          !indicatorBarDisabled,
          cpuPowerLabel
        );
        return cpuPower;
      });
    }

    // Add gpu power usage panel if metrics are available
    if (model.gpuPowerAvailable) {
      toolbarRegistry.addFactory('TopBar', 'gpu_power', () => {
        const gpuPower = GpuPowerView.createPowerView(
          model,
          !indicatorBarDisabled,
          gpuPowerLabel
        );
        return gpuPower;
      });
    }

    // Add emissions panel if metrics are available
    if (model.emissionsAvailable) {
      toolbarRegistry.addFactory('TopBar', 'emissions', () => {
        const emissions = EmissionsView.createEmissionsView(model);
        return emissions;
      });
    }
  },
};

export default extension;
