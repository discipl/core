## Discipl Core Connector modules

Discipl Core does not work without connector modules that implement basic methods for given distributed ledger, verifiable credential or legacy platforms.  
Discipl core connector modules are automaticly required, must extend the BaseConnector class (base-connector.js) and be available as module with a
unique name: 'discipl-core-name' where name uniquely identifies the supported platform.

The BaseConnector class defines what the connector modules must implement. The LocalMemoryConnector is an example implementation merely for testing purposes.
The tests folder contain tests you can easily use for (integration) testing any connector module.

  
