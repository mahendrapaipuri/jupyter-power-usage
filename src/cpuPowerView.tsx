import { ReactWidget } from '@jupyterlab/apputils';

import React, { useState, useEffect, ReactElement } from 'react';

import { IndicatorComponent } from './indicator';

import { PowerUsage } from './model';

const CpuPowerViewComponent = ({
  model,
  label,
}: {
  model: PowerUsage.Model;
  label: string;
}): ReactElement => {
  const [text, setText] = useState('');
  const [values, setValues] = useState([]);

  const update = (): void => {
    const { currentCpuPower, currentCpuPowerLimit } = model;
    const precision = 2;
    const newText = `${currentCpuPower.toFixed(precision)} ${
      currentCpuPowerLimit ? '/ ' + currentCpuPowerLimit.toFixed(0) : ''
    } W`;
    const newValues = model.values.map((value) => value.cpuPowerShare);
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
      enabled={model.cpuPowerAvailable}
      values={values}
      label={label}
      color={'#1AB7AE'}
      text={text}
    />
  );
};

export namespace CpuPowerView {
  /**
   * Create a new CpuPowerView React Widget.
   *
   * @param model The resource usage model.
   * @param label The label next to the component.
   */
  export const createPowerView = (
    model: PowerUsage.Model,
    label: string
  ): ReactWidget => {
    return ReactWidget.create(
      <CpuPowerViewComponent model={model} label={label} />
    );
  };
}
