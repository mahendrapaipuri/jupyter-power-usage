import { URLExt } from '@jupyterlab/coreutils';

import { ServerConnection } from '@jupyterlab/services';

import { EmissionFactor } from './model';

namespace RTE {
  // Open Data Soft base and API URLs
  const OPENDATASOFT_API_BASEURL = 'https://odre.opendatasoft.com';
  const OPENDATASOFT_API_PATH = '/api/records/1.0/search/';

  export const getOpenDataSoftEmissionFactor = async (): Promise<number> => {
    // Get current date in yyyy-mm-dd format
    const currentDate = new Date().toISOString().split('T')[0];

    // Make query params into a object
    const queryParams = {
      dataset: 'eco2mix-national-tr',
      facet: 'date_heure',
      start: '0',
      rows: '1',
      sort: 'date_heure',
      timezone: 'Europe/Paris',
      q: `date_heure:[${currentDate} TO #now()] AND NOT #null(taux_co2)`,
    };

    // Convert queryParams into encoded string
    const queryString = URLExt.objectToQueryString(queryParams);
    // Make full API URL
    const apiUrl = URLExt.join(
      OPENDATASOFT_API_BASEURL,
      OPENDATASOFT_API_PATH,
      queryString
    );

    // Make request and get response data
    try {
      const response = await fetch(apiUrl, { method: 'GET' });
      if (!response.ok) {
        console.debug('Request to Opendatasoft API failed');
        return null;
      }
      const data = await response.json();
      if (data && data.records && data.records.length > 0) {
        return data.records[0]?.fields?.taux_co2 || 0;
      }
    } catch (error) {
      console.info(`Request to Opendatasoft API failed due to ${error}`);
      return null;
    }
    return null;
  };
}

namespace ElectricityMaps {
  // Open Data Soft base and API URLs
  const EMAPS_API_BASEURL = 'https://api.electricitymap.org';
  const EMAPS_API_PATH = '/v3/carbon-intensity/latest';

  /**
   * Settings for making requests to the server.
   */
  const SERVER_CONNECTION_SETTINGS = ServerConnection.makeSettings();

  export const getElectricityMapsEmissionFactor = async (
    proxy: boolean,
    accessToken: string,
    countryCode: string
  ): Promise<number> => {
    // Make query params into a object
    const queryParams = {
      zone: countryCode.toUpperCase(),
    };

    // Convert queryParams into encoded string
    const queryString = URLExt.objectToQueryString(queryParams);

    // Make request and get response data
    try {
      let apiUrl: string;

      const requestHeaders: HeadersInit = new Headers();
      // Set auth token if it is not empty
      if (accessToken.length > 0) {
        requestHeaders.set('auth-token', accessToken);
      }

      if (proxy) {
        // Make a proxy request to electricty maps from jupyter server
        apiUrl = URLExt.join(
          SERVER_CONNECTION_SETTINGS.baseUrl,
          'api/metrics/v1/emission_factor/emaps',
          EMAPS_API_PATH,
          queryString
        );
      } else {
        // Make full API URL for making direct request from browser
        apiUrl = URLExt.join(EMAPS_API_BASEURL, EMAPS_API_PATH, queryString);
      }

      // Make request
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: requestHeaders,
      });

      if (!response.ok) {
        console.debug('Request to Electricity Maps API failed');
        return null;
      }
      const data = await response.json();
      if (data && data.carbonIntensity) {
        return data.carbonIntensity || 0;
      }
    } catch (error) {
      console.info(`Request to Electricity Maps failed due to ${error}`);
      return null;
    }
    return null;
  };
}

/**
 * Get eCo2 Emissions coefficient in g/kWh for a given country
 *
 * @param countryCode ISO code of the country e.g. FR, UK, US, DE.
 */
async function getEmissions(
  source: string,
  proxy: boolean,
  accessTokens: EmissionFactor.Model.IAccessTokens,
  countryCode: string
): Promise<number> {
  if (source === 'rte') {
    return await RTE.getOpenDataSoftEmissionFactor();
  } else if (source === 'emaps') {
    return await ElectricityMaps.getElectricityMapsEmissionFactor(
      proxy,
      accessTokens.emaps,
      countryCode
    );
  } else {
    return null;
  }
}

export default getEmissions;
