import { ReactWidget } from '@jupyterlab/apputils';

import React, { useState, useEffect, ReactElement } from 'react';

import { PowerUsage } from './model';

/**
 * An text component for displaying emissions.
 *
 */
const EmissionsComponent = ({
  enabled,
  text,
}: {
  enabled: boolean;
  text: string;
}): ReactElement => {
  return (
    enabled && (
      <div className="jp-IndicatorContainer">
        <div className="jp-IndicatorText">
          <span>
            eCO<sub>2</sub>:
          </span>
        </div>
        <div className="jp-IndicatorText">{text}</div>
      </div>
    )
  );
};

/**
 * A react widget to display emissions
 *
 */
export const EmissionsViewComponent = ({
  model,
}: {
  model: PowerUsage.Model;
}): ReactElement => {
  const [text, setText] = useState('');

  const update = (): void => {
    const { currentEmissions, emissionsUnits } = model;
    const precision = ['mg', 'g', 'kg'].indexOf(emissionsUnits) > 0 ? 0 : 2;
    const newText = `${currentEmissions.toFixed(precision)} ${
      model.emissionsUnits
    }`;
    setText(newText);
  };

  useEffect(() => {
    model.changed.connect(update);
    return (): void => {
      model.changed.disconnect(update);
    };
  }, [model]);

  return <EmissionsComponent enabled={model.emissionsAvailable} text={text} />;
};

export namespace EmissionsView {
  /**
   * Create a new EmissionsView React Widget.
   *
   * @param model The resource usage model.
   */
  export const createEmissionsView = (model: PowerUsage.Model): ReactWidget => {
    return ReactWidget.create(<EmissionsViewComponent model={model} />);
  };
}
