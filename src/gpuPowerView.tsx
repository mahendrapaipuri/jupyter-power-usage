import { ReactWidget } from '@jupyterlab/apputils';

import React, { useState, useEffect, ReactElement } from 'react';

import { IndicatorComponent } from './indicator';

import { PowerUsage } from './model';

const GpuPowerViewComponent = ({
  model,
  label,
}: {
  model: PowerUsage.Model;
  label: string;
}): ReactElement => {
  const [text, setText] = useState('');
  const [values, setValues] = useState([]);

  const update = (): void => {
    const { currentGpuPower, currentGpuLimit } = model;
    const precision = 2;
    const newText = `${currentGpuPower.toFixed(precision)} ${
      currentGpuLimit ? '/ ' + currentGpuLimit.toFixed(0) : ''
    } W`;
    const newValues = model.values.map((value) => value.gpuPowerShare);
    setText(newText);
    setValues(newValues);
  };

  useEffect(() => {
    model.changed.connect(update);
    return (): void => {
      model.changed.disconnect(update);
    };
  }, [model]);

  return (
    <IndicatorComponent
      enabled={model.gpuPowerAvailable}
      values={values}
      label={label}
      color={'#76B900'}
      text={text}
    />
  );
};

export namespace GpuPowerView {
  /**
   * Create a new GpuPowerView React Widget.
   *
   * @param model The resource usage model.
   * @param label The label next to the component.
   */
  export const createPowerView = (
    model: PowerUsage.Model,
    label: string
  ): ReactWidget => {
    return ReactWidget.create(
      <GpuPowerViewComponent model={model} label={label} />
    );
  };
}
