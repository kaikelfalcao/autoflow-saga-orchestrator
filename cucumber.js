module.exports = {
  default: {
    require: ['features/support/world.ts', 'features/step-definitions/**/*.ts'],
    requireModule: ['ts-node/register'],
    format: ['@cucumber/pretty-formatter'],
    paths: ['features/**/*.feature'],
  },
};
