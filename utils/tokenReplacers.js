const fsPath = require( 'path' );

const { tableFormatters } = require( './tableFormatters' );
const { readFileAsText } = require( './fileHelpers' );

async function getTokenValue( token, tokens, markdown, DO_REPLACETOKENS ) {

  if ( token.slice( 0, 5 ).toLowerCase() === 'file_' ) {
    console.log( tokens[token].join( '\' ' ) );
    const text = await readFileAsText( fsPath.join( __dirname, ...tokens[token] ) );

    return ( DO_REPLACETOKENS ) ?
      replaceTokens( tokens, text ) :
      text;

  }

  if ( token.slice( 0, 6 ) === 'table_' && tableFormatters[token] ) {
    const table = tableFormatters[token]( tokens[token], tokens );

    return ( DO_REPLACETOKENS ) ?
      replaceTokens( tokens, table ) :
      table;

  }

  return ( DO_REPLACETOKENS ) ?
    tokens[token] :
    `{{${token}}}`;

}

async function replaceTokens( tokens, markdown, DO_REPLACETOKENS ) {

  const keys = Object.keys( tokens );
  let replaced = markdown;

  for ( const k of keys ) {

    if ( replaced.indexOf( k ) === -1  )
      continue;

    const replacement = await getTokenValue( k, tokens ) || '';
    const regex = new RegExp( `{{${k}}}`, 'g' );

    replaced = replaced.replace( regex, replacement );

  }

  return replaced;

}

module.exports = {
  getTokenValue,
  replaceTokens,
};
