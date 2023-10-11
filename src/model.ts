// Some parts of this code is adapted from:
// https://github.com/jupyterlab/jupyterlab/blob/22cbc926e59443c67a80fcd363bb2de653087910/packages/statusbar/src/defaults/memoryUsage.tsx
// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { VDomModel } from '@jupyterlab/apputils';

import { URLExt } from '@jupyterlab/coreutils';

import { ServerConnection } from '@jupyterlab/services';

import { Poll } from '@lumino/polling';

import { ISignal, Signal } from '@lumino/signaling';

import { EmissionsUnit, convertToLargestUnit } from './format';

import getEmissions from './emissionsHandler';

/**
 * Number of values to keep in power.
 */
const N_BUFFER = 20;

/**
 * A namespace for PowerUsage statics.
 */
export namespace PowerUsage {
  /**
   * A model for the power usage items.
   */
  export class Model extends VDomModel {
    /**
     * Construct a new power usage model.
     *
     * @param options The options for creating the model.
     */
    constructor(model: EmissionFactor.Model, options: Model.IOptions) {
      super();
      this._emissionModel = model;
      for (let i = 0; i < N_BUFFER; i++) {
        this._values.push({ cpuPowerShare: 0, gpuPowerShare: 0 });
      }
      this._poll = new Poll<Private.IPowerUsageResult | null>({
        factory: (): Promise<Private.IPowerUsageResult> =>
          Private.powerUsageFactory(),
        frequency: {
          interval: options.refreshRate,
          backoff: true,
        },
        name: 'jupyter-power-usage:PowerUsage#metrics',
      });
      this._poll.ticked.connect((poll) => {
        const { payload, phase } = poll.state;
        if (phase === 'resolved') {
          this._updateMetricsValues(payload);
          return;
        }
        if (phase === 'rejected') {
          const oldCpuPowerUsageAvailable = this._cpuPowerUsageAvailable;
          this._cpuPowerUsageAvailable = false;
          this._gpuPowerUsageAvailable = false;
          this._emissionsAvailable = false;
          this._currentCpuPowerLimit = null;
          this._currentCpuPowerUsage = null;
          this._currentGpuPowerUsage = null;
          this._currentGpuPowerLimit = null;
          this._currentEmissions = null;

          if (oldCpuPowerUsageAvailable) {
            this.stateChanged.emit();
          }
          return;
        }
      });
    }

    /**
     * A promise that resolves after the next request.
     */
    async refresh(): Promise<void> {
      await this._poll.refresh();
      await this._poll.tick;
    }

    /**
     * Whether the CPU power metric is available.
     */
    get cpuPowerAvailable(): boolean {
      return this._cpuPowerUsageAvailable;
    }

    /**
     * Whether the GPU power metric is available.
     */
    get gpuPowerAvailable(): boolean {
      return this._gpuPowerUsageAvailable;
    }

    /**
     * Whether the CO2 emission metric is available.
     */
    get emissionsAvailable(): boolean {
      return (
        this._emissionsAvailable &&
        (this._cpuPowerUsageAvailable || this._gpuPowerUsageAvailable)
      );
    }

    /**
     * The current CPU power usage by the user.
     */
    get currentCpuPower(): number | null {
      return this._currentCpuPowerUsage;
    }

    /**
     * The current total CPU power usage by the host.
     */
    get currentCpuPowerLimit(): number | null {
      return this._currentCpuPowerLimit;
    }

    /**
     * The current GPU power usage.
     */
    get currentGpuPower(): number | null {
      return this._currentGpuPowerUsage;
    }

    /**
     * The current GPU power limit.
     */
    get currentGpuLimit(): number | null {
      return this._currentGpuPowerLimit;
    }

    /**
     * The current eCo2 emissions.
     */
    get currentEmissions(): number | null {
      return this._currentEmissions;
    }

    /**
     * The total eCo2 emissions.
     */
    get totalEmissions(): number {
      return this._totalEmissions;
    }

    /**
     * The units for emissions.
     */
    get emissionsUnits(): EmissionsUnit {
      return this._emissionsUnits;
    }

    /**
     * A signal emitted when the power usage model changes.
     */
    get changed(): ISignal<PowerUsage.Model, void> {
      return this.stateChanged;
    }

    /**
     * Get a list of the last metric values.
     */
    get values(): Model.IMetricValue[] {
      return this._values;
    }

    /**
     * Dispose of the power usage model.
     */
    dispose(): void {
      this._poll.dispose();
    }

    /**
     * Given the results of the metrics request, update model values.
     *
     * @param value The metric request result.
     */
    private _updateMetricsValues(
      value: Private.IPowerUsageResult | null
    ): void {
      if (value === null) {
        this._cpuPowerUsageAvailable = false;
        this._gpuPowerUsageAvailable = false;
        this._emissionsAvailable = false;
        this._currentCpuPowerLimit = null;
        this._currentCpuPowerUsage = null;
        this._currentGpuPowerUsage = null;
        this._currentGpuPowerLimit = null;
        this._currentEmissions = null;
        return;
      }

      const cpuUsage = value.cpu ? value.cpu.usage : null;
      const cpuLimit = value.cpu ? value.cpu.limit : null;
      this._cpuPowerUsageAvailable = cpuUsage ? true : false;

      this._currentCpuPowerUsage = cpuUsage;
      this._currentCpuPowerLimit = cpuLimit;

      const gpuUsage = value.gpu ? value.gpu.usage : null;
      const gpuLimit = value.gpu ? value.gpu.limit : null;
      this._gpuPowerUsageAvailable = gpuUsage ? true : false;

      this._currentGpuPowerUsage = gpuUsage;
      this._currentGpuPowerLimit = gpuLimit;

      const { emissionFactorAvailable, currentEmissionFactor } =
        this._emissionModel;
      this._lastEmissionFactor = emissionFactorAvailable
        ? currentEmissionFactor
        : this._lastEmissionFactor;
      this._emissionsAvailable = this._lastEmissionFactor !== null;

      if (this._emissionsAvailable) {
        // Current emissions is currentEmissionFactor (mg/Ws) * currentCpuPower (W) * period (ms) / 1000
        const currentPeriod = Date.now() - this._lastEmissionReading;
        const powerUsage = (cpuUsage || 0) + (gpuUsage || 0);
        const currentEmissions =
          (this._lastEmissionFactor * powerUsage * currentPeriod) / 1000;
        this._lastEmissionReading = Date.now();
        const currentTotalEmissions = this._totalEmissions + currentEmissions;
        const [readableCurrentTotalEmissions, units] = convertToLargestUnit(
          currentTotalEmissions
        );
        this._currentEmissions = readableCurrentTotalEmissions;
        this._emissionsUnits = units;
        this._totalEmissions = currentTotalEmissions;
      }

      const cpuPowerShare = this._currentCpuPowerLimit
        ? Math.min(this._currentCpuPowerUsage / this._currentCpuPowerLimit, 1)
        : null;

      const gpuPowerShare =
        this._currentGpuPowerUsage && this._currentGpuPowerLimit
          ? Math.min(this._currentGpuPowerUsage / this._currentGpuPowerLimit, 1)
          : null;

      this._values.push({
        cpuPowerShare: cpuPowerShare,
        gpuPowerShare: gpuPowerShare,
      });
      this._values.shift();
      this.stateChanged.emit(void 0);
    }

    private _cpuPowerUsageAvailable = false;
    private _gpuPowerUsageAvailable = false;
    private _emissionsAvailable = false;
    private _currentCpuPowerLimit: number | null = null;
    private _currentCpuPowerUsage: number | null = null;
    private _currentGpuPowerUsage: number | null = null;
    private _currentGpuPowerLimit: number | null = null;
    private _currentEmissions: number | null = null;
    private _lastEmissionReading: number = Date.now();
    private _lastEmissionFactor: number | null = null; // Lastly found non null emission factor
    private _totalEmissions = 0; // Monotonically increasing variable in mg
    private _emissionsUnits: EmissionsUnit;
    private _emissionModel: EmissionFactor.Model;
    private _poll: Poll<Private.IPowerUsageResult | null>;
    private _values: Model.IMetricValue[] = [];
  }

  /**
   * A namespace for Model statics.
   */
  export namespace Model {
    /**
     * Options for creating a PowerUsage model.
     */
    export interface IOptions {
      /**
       * The refresh rate (in ms) for querying the server.
       */
      refreshRate: number;
    }

    /**
     * An interface for metric values.
     */
    export interface IMetricValue {
      /**
       * The user power consumption percentage.
       */
      cpuPowerShare: number | null;

      /**
       * The GPU power consumption percentage.
       */
      gpuPowerShare: number | null;
    }
  }
}

/**
 * A namespace for eCo2 Emission factor statics.
 */
export namespace EmissionFactor {
  /**
   * A model for the eCo2 emission factor items.
   */
  export class Model {
    /**
     * Construct a new eCo2 emissions model.
     *
     * @param options The options for creating the model.
     */
    constructor(options: Model.IOptions) {
      this._poll = new Poll<number | null>({
        factory: (): Promise<number> =>
          Private.emissionsFactory(
            options.countryCode,
            options.defaultEmissionFactor
          ),
        frequency: {
          interval: options.refreshRate,
          backoff: true,
        },
        name: 'jupyter-power-usage:EmissionFactor#metrics',
      });
      this._poll.ticked.connect((poll) => {
        const { payload, phase } = poll.state;
        if (phase === 'resolved') {
          this._updateMetricsValues(payload);
          return;
        }
        if (phase === 'rejected') {
          const oldEmissionFactorAvailable = this._emissionFactorAvailable;
          this._emissionFactorAvailable = false;
          this._currentEmissionFactor = null;

          if (oldEmissionFactorAvailable) {
            this._changed.emit();
          }
          return;
        }
      });
    }

    /**
     * A promise that resolves after the next request.
     */
    async refresh(): Promise<void> {
      await this._poll.refresh();
      await this._poll.tick;
    }

    /**
     * Whether the eCo2 emissions factor is available.
     */
    get emissionFactorAvailable(): boolean {
      return this._emissionFactorAvailable;
    }

    /**
     * The current eCo2 emission factor.
     */
    get currentEmissionFactor(): number | null {
      return this._currentEmissionFactor;
    }

    /**
     * Dispose of the power usage model.
     */
    dispose(): void {
      this._poll.dispose();
    }

    /**
     * Given the results of the metrics request, update model values.
     *
     * @param value The metric request result.
     */
    private _updateMetricsValues(value: number | null): void {
      if (value === null) {
        this._emissionFactorAvailable = false;
        this._currentEmissionFactor = null;
        return;
      }

      const emissionFactor = value;
      this._emissionFactorAvailable = emissionFactor !== null;

      this._currentEmissionFactor = emissionFactor;
      this._changed.emit(void 0);
    }

    private _emissionFactorAvailable = false;
    private _currentEmissionFactor: number | null = null;
    private _poll: Poll<number | null>;
    private _changed = new Signal<this, void>(this);
  }

  /**
   * A namespace for Model statics.
   */
  export namespace Model {
    /**
     * Options for creating a Emissions model.
     */
    export interface IOptions {
      /**
       * The refresh rate (in ms) for updating emissions (g/kWh) value.
       */
      refreshRate: number;

      /**
       * The country for which we are querying emissions API server.
       */
      countryCode: string;

      /**
       * Default emissions factor that will be used in case of unavailable data
       */
      defaultEmissionFactor: number;
    }
  }
}

/**
 * A namespace for module private statics.
 */
namespace Private {
  /**
   * Settings for making requests to the server.
   */
  const SERVER_CONNECTION_SETTINGS = ServerConnection.makeSettings();

  /**
   * The url endpoint for making requests to the server.
   */
  const METRIC_URL = URLExt.join(
    SERVER_CONNECTION_SETTINGS.baseUrl,
    'api/metrics/v1/power_usage'
  );

  /**
   * Emissions factor conversion from g/kWh to mg/Ws.
   */
  const EF_UNIT_CONVERSION = 3600;

  /**
   * The shape of a response from the power usage server extension.
   */
  export interface IPowerUsageResult {
    cpu?: {
      usage: number;
      limit: number;
    };
    gpu?: {
      usage: number;
      limit: number;
    };
  }

  /**
   * Make a request to the backend.
   */
  export const powerUsageFactory =
    async (): Promise<IPowerUsageResult | null> => {
      const request = ServerConnection.makeRequest(
        METRIC_URL,
        {},
        SERVER_CONNECTION_SETTINGS
      );
      const response = await request;

      if (response.ok) {
        return await response.json();
      }

      return null;
    };

  /**
   * Make a request to the emissions backend.
   */
  export const emissionsFactory = async (
    countryCode: string,
    defaultEmissionFactor: number
  ): Promise<number | null> => {
    // This is emission factor typically expressed in g/kWh
    // We convert it to mg/Ws here
    const emissionFactor = await getEmissions(countryCode);
    if (emissionFactor) {
      return emissionFactor / EF_UNIT_CONVERSION;
    }
    return defaultEmissionFactor / EF_UNIT_CONVERSION;
  };
}
