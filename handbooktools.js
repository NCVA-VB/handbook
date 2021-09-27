// CLI APPLICATION FOR PERFORMING VARIOUS ADMIN ACTIONS ON HANDBOOKDATA

require( 'make-promises-safe' );

const yargs = require( 'yargs' )( process.argv.slice( 2 ) );
const fsPath = require( 'path' );
const clip = require( 'copy-paste' );
// const readline = require( 'readline' );

const handbookdata = require( './handbookdata' );
const { readFileAsText } = require( './utils/fileHelpers' );
const { tableFormatters } = require( './utils/tableFormatters' );
const { markdown: md } = require( './utils/markdownTools' );
const { replaceTokens } = require( './utils/tokenReplacers' );

function getTokens( handbookdata, handbook ) {
  return { ...handbookdata.commonTokens, ...handbook.tokens };
}

async function loadSection(  handbookdata, book, section ) {

  console.log( book.name );
  console.log( section.sectionName );

  if ( !section ) {
    console.log( `Section not found: ${section.sectionName}` );
    process.exit( 0 );
  }

  const path = ( section.path ) ?
    fsPath.join( __dirname, ...section.path, `${section.fileName}.md` ) :
    fsPath.join( __dirname, book.name, `${section.fileName}.md` );

  const rawText = await readFileAsText( path );

  if ( !rawText ) {
    console.log( `FILE NOT FOUND: ${path}` );
    console.log( section );
  }

  return rawText;

}

function filterForTableTokens( tokens ) {
  return tokens.filter( ( k ) => ( k.slice( 0, 6 ) === 'table_'  ) );
}


const commands = {
  'exportsection': async function exportSection( handbookdata, argv ) {

    const book = handbookdata.handbooks.find( ( b ) => b.name === argv.bookname );
    const section = book.sections.find( ( s ) => s.fileName === argv.sectionname );
    const text = await loadSection( handbookdata, book, section );
    const markdown = await replaceTokens( getTokens( handbookdata, book ), text, true );
    const html = md.render( markdown );
    clip.copy( html, () => process.exit( 0 ) );

  },
  'exporttable': async function exportTable( handbookdata, DO_REPLACETOKENS, argv ) {

    const book = handbookdata.handbooks.find( ( book ) => book.name === argv.bookname );
    const tokens = { ...handbookdata.commonTokens, ...book.tokens };
    const table = tokens[argv.tablename];
    const text = await tableFormatters[argv.tablename]( table, tokens );

    const html = [
      `<!-- ${argv.tablename}-->`,
      md.render( text ),
    ];

    clip.copy( html.join( '\n' ), () => {

      console.log( 'Output has been placed in the clipboard.' );
      console.log();
      console.log();

      process.exit( 0 );

    } );

  },
  'exporttokens': async function exportTokens( handbookdata, argv ) {

    function reduceTokens( type, tokens ) {

      return `${Object
        .keys( tokens )
        .filter( ( k ) => !k.startsWith( 'file_' ) && !k.startsWith( 'table_' ) )
        .reduce( ( acc, k ) => {

          acc.push( `${k}\t${tokens[k]}` );
          return acc;

        }, [type] )
        .join( '\r\n' )}\r\n\r\n`;

    }

    const commonTokens = reduceTokens( 'COMMON', handbookdata.commonTokens );

    const bookTokens = handbookdata.handbooks
      .map( ( book ) => reduceTokens( book.name.toUpperCase(), book.tokens ) )
      .join( '\r\n' );

    clip.copy( commonTokens + bookTokens, () => {

      console.log( 'Output has been placed in the clipboard.' );
      console.log();
      console.log();

      process.exit( 0 );

    }  );


  },
  'rendermarkdown': async function renderMarkdown( handbookdata, argv ) {

    const content = clip.paste();
    clip.copy( md.render( content ), () => process.exit( 1 ) );

  },
};

console.log( '' );
console.log( '' );

const DO_REPLACETOKENS = true;

async function runTools( handbookdata ) {

  const tableNames = new Set( filterForTableTokens( Object.keys( handbookdata.commonTokens ) ) );

  handbookdata.handbooks.forEach( ( book ) => {

    filterForTableTokens( Object.keys( book.tokens ) )
      .forEach( ( t ) => tableNames.add( t ) );

  } );

  yargs
    .command(
      'exporttable <bookname> <tablename>',
      'Export a specific table to HTML and place in the clipboard.',
      {
        'bookname': {
          'alias': 'b',
        },
        'tablename': {
          'alias': 't',
        },
      },
      async ( argv ) => {
        commands.exporttable( handbookdata, DO_REPLACETOKENS, argv );
      },
    )
    .command(
      'exportsection <bookname> <sectionname>',
      'Export a book section and render to clipboard.',
      {
        'bookname': {
          'alias': 'b',
        },
        'sectionname': {
          'alias': 's',
        },
      },      async ( argv ) => {
        commands.exportsection( handbookdata, argv );
      },
    )
    .command(
      'exporttokens',
      'Export tokens into spreadsheet format and place in the clipboard.',
      async ( argv ) => {
        commands.exporttokens( handbookdata, argv );
      },
    )
    .command(
      'clipboardtohtml',
      'Render clipboard contents as HTML (clipboard contents should be in markdown format).',
      async ( argv ) => {
        commands.rendermarkdown( handbookdata, argv );
      },
    )
    .choices( 'tablename', [...tableNames] )
    .demandCommand(
      1,
      'A command is required.',
      'Only one command is allowed.',
    )
    .strictCommands( true )
    .help()
    .parse();

}

runTools( handbookdata );
