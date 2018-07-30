
let vows = require('vows')
let assert = require('assert')
let rewire = require("rewire")
let discipl = rewire('../index.js')
let suite = vows.describe('discipl-core-api').addBatch({
  'A Discipl Core API ' : {
    'can use discipl links like: link:discipl:memory1234 ' : {
      topic : 'link:discipl:memory1234',
      'internally to obtain the connector name and reference from the link ' : function (topic) {
        assert(discipl.__get__('splitLink')(topic), {'connector':'memory','reference':'1234'})
      }
    }
  }
}).export(module)
