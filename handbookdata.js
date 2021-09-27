const boys = require( './data/boys' );
const girls = require( './data/girls' );
const officials = require( './data/officials' );
const highperformance = require( './data/highperformance' );
const common = require( './data/common' );

const { formatNumbers } = require( './utils/helpers' );

const data = {
  'handbooks': [
    boys,
    girls,
    highperformance,
    officials,
  ],
  'commonTokens': common,
};

formatNumbers( data.commonTokens );
data.handbooks.forEach( ( book ) => formatNumbers( book.tokens ) );

data.commonTokens = {
  'pagebreak': '<div style="page-break-after: always;"></div>\r\n\r\n',
  ...data.commonTokens,
};

module.exports = data;
