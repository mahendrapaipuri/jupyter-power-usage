import { URLExt } from '@jupyterlab/coreutils';

namespace France {
  // Open Data Soft base and API URLs
  const OPENDATASOFT_API_BASEURL = 'https://odre.opendatasoft.com';
  const OPENDATASOFT_API_PATH = '/api/records/1.0/search/';

  export const getOpenDataSoftEmissions = async (): Promise<number> => {
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

/**
 * Get eCo2 Emissions coefficient in g/kWh for a given country
 *
 * @param countryCode ISO code of the country e.g. fr, uk, us, de.
 */
async function getEmissions(countryCode: string): Promise<number> {
  if (countryCode === 'fr') {
    return await France.getOpenDataSoftEmissions();
  } else {
    return null;
  }
}

export default getEmissions;
