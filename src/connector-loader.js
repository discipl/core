const CONNECTOR_MODULE_PREFIX = 'discipl-core-'

/**
 * requires and holds in memory the given discipl connector (if not done before)
 */
const loadConnector = async (connectorName) => {
  let module = await import(CONNECTOR_MODULE_PREFIX + connectorName)
  return module.default
}

export { loadConnector }
