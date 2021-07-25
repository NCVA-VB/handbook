const fsPath = require( 'path' );
const clip = require( 'copy-paste' );
const readline = require( 'readline' );

const {
  markdown: md,
} = require( './utils/markdownTools' );

const {
  dirMake,
  readFileAsJSON,
  readFileAsText,
  writeFileAsText,
} = require( './utils/fileHelpers' );

const { replaceTokens } = require( './utils/tokenReplacers' );

const rl = readline.createInterface( {
  'input'  : process.stdin,
  'output' : process.stdout,
} );




function queryHandbook( rl, handbooks ) {

  return new Promise( ( resolve, reject ) => {

    console.log();
    console.log();
    console.log( 'Output Handbooks:' );
    handbooks.forEach( ( hb, h ) => console.log( `${h + 1}.) ${hb.name.toUpperCase()}` ) );
    console.log( '* to output ALL Handbooks.' );
    console.log();

    rl.question( 'Enter the number of the handbook you would like to output:', ( answer ) => {

      if ( answer === '' )
        process.exit( 0 );

      if ( !answer )
        return resolve( handbooks );

      const bookNumber = parseInt( answer, 10 ) - 1;
      const book = handbooks[bookNumber];
      resolve( book );

    } );
  } );

}

function renderSectionPage( tokens, sectionName ) {
  return md.render( `<div class="sectionintro">\n\n![NCVA Logo](${tokens.url_ncva_logo})\n# ${sectionName}\n\n</div>\n\n` );
}

async function selectBooks( handbookdata ) {

  let handbook;

  while ( !handbook ) {

    handbook = await queryHandbook( rl, handbookdata.handbooks );

    if ( !handbook )
      console.log( 'Invalid Selection - please try again.' );

  }

  return ( Array.isArray( handbook ) ) ?
    handbook :
    [handbook];

}

async function outputHandBooks( books, commonTokens, DO_REPLACETOKENS ) {

  const renderedBooks = [];

  for ( const handbook of books ) {

    const { files } = handbook;
    const tokens = { ...commonTokens, ...handbook.tokens };

    // INITIAL STRUCTURE OF THE PAGE:
    // TITLE PAGE
    // TOC
    // PAGEBREAK
    const parts = [
      renderSectionPage( tokens, handbook.title ),
      md.render( '# Table of Contents' ),
      '[[toc]]',
      tokens.pagebreak,
    ];

    let idx = 0;

    for ( const fileDesc of files ) {

      // INSERT A SECTION INTRO PAGE
      // INSERT IT AS RENDERED HTML SO THAT TOC GENERATION IGNORES IT
      parts.push( renderSectionPage( tokens, fileDesc.sectionName ) );

      // PUSH A PAGE BREAK AFTER EACH SECTION EXCEPT THE LAST
      if ( idx < files.length - 1  )
        parts.push( tokens.pagebreak );

      const path = ( fileDesc.path ) ?
        fsPath.join( __dirname, ...fileDesc.path, `${fileDesc.fileName}.md` ) :
        fsPath.join( __dirname, handbook.name, `${fileDesc.fileName}.md` );

      const rawText = await readFileAsText( path );

      if ( !rawText ) {
        console.log( `FILE NOT FOUND: ${path}` );
        console.log( fileDesc );
      }

      parts.push( rawText );
      idx++;

    }

    const markdown = await replaceTokens( tokens, parts.join( '\n' ), DO_REPLACETOKENS );
    const html = md.render( markdown );
    const outputPath = fsPath.join( __dirname, handbook.name, 'output' );

    await dirMake( outputPath );

    await writeFileAsText(
      html,
      outputPath,
      `${handbook.name}.html`,
    );

    renderedBooks.push( html );

  }

  return renderedBooks;

}

const DO_REPLACETOKENS = true;

( async () => {

  const handbookdata = await readFileAsJSON( fsPath.join( __dirname, 'handbookdata.json' ) );
  const books = await selectBooks( handbookdata );

  const html = await outputHandBooks(
    books,
    handbookdata.commonTokens,
    DO_REPLACETOKENS,
  );

  if ( html.length === 1 )
    clip.copy( html[0], () => process.exit( 0 ) );

  console.log( 'Output Complete.' );
  console.log();
  console.log();

} )();


