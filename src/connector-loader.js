const CONNECTOR_MODULE_PREFIX = '@discipl/core-'

/**
 * Loads a connector based on module name using a dynamic import
 *
 * @param {string} connectorName
 * @returns {object} The corresponding connector
 */
const loadConnector = async (connectorName) => {
  let module = await import(CONNECTOR_MODULE_PREFIX + connectorName)

  return module.default
}

export { loadConnector }
