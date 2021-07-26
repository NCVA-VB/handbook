const fsPath = require( 'path' );
const MarkdownIt = require( 'markdown-it' );
const MarkdownItSup = require( 'markdown-it-sup' );
const MarkdownItAnchor = require( 'markdown-it-anchor' );
const MarkdownItTOC = require( 'markdown-it-table-of-contents' );
const MarkdownPDF = require( 'markdown-pdf' );
const MarkdownItContainer = require( 'markdown-it-container' );
const MarkdownItTable = require( 'markdown-it-multimd-table' );

const {
  writeFileAsText,
} = require( './fileHelpers' );


const md = new MarkdownIt( {
  'html'        : true,
  'linkify'     : true,
  'typographer' : true,
} );

md.use( MarkdownItSup );
md.use( MarkdownItAnchor );
md.use( MarkdownItContainer, 'sponsorcontainer' );
md.use( MarkdownItContainer, '--centered' );
md.use( MarkdownItTable );

md.use(
  MarkdownItTOC,
  {
    'includeLevel': [1, 2, 3, 4, 5, 6],
  },
);


function outputPDF( outputName, markdown, outputPath ) {

  const mdOutput = fsPath.join( outputPath, `${outputName}.md` );
  const pdfOutput = fsPath.join( outputPath, `${outputName}.pdf` );

  return writeFileAsText( markdown, outputPath, `${outputName}.md` )
    .then( () => {

      return new Promise( ( resolve, reject ) => {

        MarkdownPDF()
          .from( mdOutput )
          .to( pdfOutput, () => resolve() );

      } );

    } );

}

module.exports = {
  'markdown'  : md,
  'outputPDF' : outputPDF,
};
