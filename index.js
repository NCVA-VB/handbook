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

const { replaceTokens, highlightMissingTokens } = require( './utils/tokenReplacers' );

const rl = readline.createInterface( {
  'input'  : process.stdin,
  'output' : process.stdout,
} );

function formatNumbers( input ) {

  Object
    .keys( input )
    .filter( ( k ) => k.startsWith( 'fee_' ) )
    .forEach( ( k ) => {

      const parts = input[k].toFixed( 2 ).split( '.' );
      input[`${k}_formatted`] =  `$${parts[0]}^.${parts[1]}^`;

    } );

}

async function loadHandbookData() {

  const handbookdata = await readFileAsJSON( fsPath.join( __dirname, 'handbookdata.json' ) );

  formatNumbers( handbookdata.commonTokens );
  handbookdata.handbooks.forEach( ( book ) => formatNumbers( book.tokens ) );

  handbookdata.commonTokens = {
    'pagebreak': '<div style="page-break-after: always;"></div>\n\n',
    ...handbookdata.commonTokens,
  };

  return handbookdata;


}

async function outputHandBooks( books, commonTokens, DO_REPLACETOKENS ) {

  const renderedBooks = [];

  for ( const handbook of books ) {

    const { sections } = handbook;
    const tokens = { ...commonTokens, ...handbook.tokens };

    // INITIAL STRUCTURE OF THE PAGE:
    // TITLE PAGE
    // TOC
    // PAGEBREAK
    const initialParts = [
      renderSectionPage( tokens, handbook.title ),
      md.render( '# Table of Contents' ),
      '[[toc]]',
      tokens.pagebreak,
    ];

    const sectionParts = await Promise.all(
      sections.map( async ( fileDesc, idx ) => {

        // INSERT A SECTION INTRO PAGE
        // INSERT IT AS RENDERED HTML SO THAT TOC GENERATION IGNORES IT
        const fileParts = [
          renderSectionPage( tokens, fileDesc.sectionName ),
        ];

        // PUSH A PAGE BREAK AFTER EACH SECTION EXCEPT THE LAST
        if ( idx < sections.length - 1  )
          fileParts.push( tokens.pagebreak );

        const path = ( fileDesc.path ) ?
          fsPath.join( __dirname, ...fileDesc.path, `${fileDesc.fileName}.md` ) :
          fsPath.join( __dirname, handbook.name, `${fileDesc.fileName}.md` );

        const rawText = await readFileAsText( path );

        if ( !rawText ) {
          console.log( `FILE NOT FOUND: ${path}` );
          console.log( fileDesc );
        }

        return `${fileParts.join( '\n' )}\n${rawText}`;

      } ),
    );

    const allParts = [...initialParts, ...sectionParts].join( '\n' );

    const markdown = await replaceTokens( tokens, allParts, DO_REPLACETOKENS );
    const html = md.render( highlightMissingTokens( markdown ) );
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

const DO_REPLACETOKENS = true;

( async () => {

  const handbookdata = await loadHandbookData();

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


