#!/usr/bin/env node

const oclif = require('@oclif/core')

// This is the standard and correct way to run oclif
oclif.run()
  .then(oclif.flush)
  .catch(oclif.Errors.handle)