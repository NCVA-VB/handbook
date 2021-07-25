// CLI APPLICATION FOR PERFORMING VARIOUS ADMIN ACTIONS ON HANDBOOKDATA

require( 'make-promises-safe' );

const yargs = require( 'yargs' )( process.argv.slice( 2 ) );
const fsPath = require( 'path' );
const clip = require( 'copy-paste' );
// const readline = require( 'readline' );

const { readFileAsJSON } = require( './utils/fileHelpers' );
const { tableFormatters } = require( './utils/tableFormatters' );
const { markdown } = require( './utils/markdownTools' );


const commands = {
  'exporttable': async function exportTable( handbookdata, DO_REPLACETOKENS, argv ) {

    const book = handbookdata.handbooks.find( ( book ) => book.name === argv.bookname );
    const table = book.tokens[argv.tablename];

    const md = await tableFormatters[argv.tablename]( table, { ...handbookdata.commonTokens, ...book.tokens } );
    const html = [
      `<!-- ${argv.tablename}-->`,
      markdown.render( md ),
    ];

    clip.copy( html.join( '\n' ), () => {

      console.log( 'Output has been placed in the clipboard.' );
      console.log();
      console.log();

      process.exit( 0 );

    } );

  },
};

console.log( '' );
console.log( '' );

const DO_REPLACETOKENS = true;

async function runTools() {

  const handbookdata = await readFileAsJSON( fsPath.join( __dirname, 'handbookdata.json' ) );

  const tableNames = handbookdata.handbooks.reduce( ( names, book ) => {

    return Object.keys( book.tokens ).reduce( ( names, k ) => {

      if ( k.slice( 0, 6 ) === 'table_' )
        names.add( k );

      return names;

    }, names );

  }, new Set() );

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
        // console.log( argv );
        commands[argv._[0]]( handbookdata, DO_REPLACETOKENS, argv );
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

runTools();
