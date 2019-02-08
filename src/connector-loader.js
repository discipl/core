const CONNECTOR_MODULE_PREFIX = '@discipl/core-'

/**
 * loads a connector based on module name using a dynamic import
 */
const loadConnector = async (connectorName) => {
  let module = await import(CONNECTOR_MODULE_PREFIX + connectorName)
  return module.default
}

export { loadConnector }
