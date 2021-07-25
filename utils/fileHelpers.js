/* eslint-disable no-restricted-syntax */
const child = require( 'child_process' );
const fs = require( 'fs' );
const fsPath = require( 'path' );
const { promisify } = require( 'util' );
const { EOL } = require( 'os' );
const helpers = require( './helpers' );

const { sep: pathSeparator } = fsPath;

const {
  splitArray,
  throwOpErr,
} = helpers;

const access = promisify( fs.access );
const fileCopy = promisify( fs.copyFile );
const fsAppend = promisify( fs.appendFile );
const fsDelete = promisify( fs.unlink );
const fsUnlink = promisify( fs.unlink );
const fsMakeDir = promisify( fs.mkdir );
const readDir = promisify( fs.readdir );
const readFile = promisify( fs.readFile );
const readFileStats = promisify( fs.stat );
const renameFile = promisify( fs.rename );
const writeFile = promisify( fs.writeFile );


const copyFilesInBatches = ( () => {

  async function copyFileBatches( opts ) {

    const {
      batches,
      destination,
      eachBatch,
      moveFiles,
      namesMap,
      overwrite,
    } = opts;

    if ( !batches.length )
      return eachBatch( [], 0 );

    const batch = batches.shift();

    if ( !batch.length )
      return eachBatch( [], 0 );

    await copyFiles( {
      'files'       : batch,
      'destination' : destination,
      'moveFiles'   : moveFiles,
      'namesMap'    : namesMap,
      'overwrite'   : overwrite,
    } );

    const ok = await eachBatch( batch, batches.length );

    if ( ok )
      return copyFileBatches( opts );

  }

  return async function copyFilesInBatches( opts ) {

    const {
      batchSize,
      destination,
      eachBatch = () => {},
      files,
      moveFiles = false,
      namesMap,
      overwrite,
    } = opts;

    if ( !files || !files.length )
      return eachBatch( [] );

    try {

      const batches = splitArray( files, batchSize );

      return copyFileBatches( {
        'batches'     : batches,
        'destination' : destination,
        'moveFiles'   : moveFiles,
        'namesMap'    : namesMap,
        'overwrite'   : overwrite,
        'eachBatch'   : eachBatch,
      } );

    } catch ( e ) {
      throwOpErr( `copyFilesInBatches operation failed with message: ${e.message}`, opts );
    }

  };


} )();


async function copyFiles( opts ) {

  function getFileName( file, namesMap ) {

    if ( namesMap )
      return namesMap.get( file );

    return file
      .split( fsPath.sep )
      .pop();

  }

  const {
    files,
    destination,
    fn = () => {},
    moveFiles,
    namesMap,
    overwrite,
  } = opts;

  const { COPYFILE_EXCL } = fs.constants;
  const promises = [];

  for ( const file of files ) {

    try {

      // PROVIDE A NAMESMAP WHERE KEY IS SOURCEPATHANDFILE AND VALUE IS NEW NAME
      // IF NOT PROVIDED, USE EXISTING NAME;
      const fileName = getFileName( file, namesMap );
      const destPath = fsPath.join( destination, fileName );

      if ( moveFiles ) {

        const promise = renameFile( file, destPath );
        promises.push( promise );
        continue;

      }

      const promise = ( overwrite ) ?
        fileCopy( file, destPath ) :
        fileCopy( file, destPath, COPYFILE_EXCL );

      promises.push( promise );

    // eslint-disable-next-line no-empty
    } catch ( e ) {}

  }

  await Promise.all( promises );
  fn( files );

}

async function exist( path ) {

  try {

    await access( path );
    return true;

  } catch ( err ) {
    return false;
  }

}

function dirItemize( path, fileMask ) {

  return readDirectory(
    path,
    fileMask,
    { 'includeFiles': false },
  );

}

const dirMake = ( () => {

  async function make( path ) {

    try {
      await fsMakeDir( path );
      return path;
    } catch ( e ) {

      if ( e.code === 'EEXIST' )
        return path;

      return false;

    }

  }

  function getParent( path ) {
    const parts = path.split( fsPath.sep );
    return fsPath.join.apply( null, parts.slice( 0, parts.length - 1 ) );
  }

  return async function dirMake( path ) {

    if ( !path )
      return false;

    const parent = getParent( path );

    const [pathCheck, parentCheck] = await Promise.all( [
      exist( path ),
      exist( parent ),
    ] );

    if ( pathCheck )
      return true;

    if ( !parentCheck )
      await dirMake( parent );

    return make( path );

  };

} )();

function enumerateDrives( fixed = false ) {

  // WINDOWS SPECIFIC METHOD TO ENUMERATE CONNECTED DRIVES.
  return new Promise( ( resolve, reject ) => {

    const pattern = /[A-Za-z]:/;

    const cmd = ( fixed ) ?
      'wmic logicaldisk where drivetype=3 get name' :
      'wmic logicaldisk get name';

    child.exec( cmd, ( error, stdout ) => {

      if ( error )
        reject( error );

      const paths = stdout.split( '\r\r\n' )
        .filter( ( value ) => pattern.test( value ) )
        .map( ( value ) => value.trim() );

      resolve( paths );

    } );

  } );

}

function fileDelete( path ) {

  return fsDelete( path )
    .catch( ( e ) => false )
    .then( () => true );

}

/**
 *Get list of files in a directory. Options Object composed of: { path, fileMask, filter, returnWithPath }
 * @param {*} opts
 */
async function fileItemize( opts = {} ) {

  const {
    path,
    fileMask = [],
    filter,
    returnWithPath = false,
  } = opts;

  const found = await readDirectory(
    path,
    fileMask,
    { 'includeDirectories': false },
  );

  const files = ( filter ) ?
    found.filter( filter ) :
    found;

  return ( returnWithPath ) ?
    files.map( ( file ) => fsPath.join( path, file ) ) :
    files;

}

async function fileMove( source, dest, overrite = false ) {

  const exists = await exist( dest );

  if ( exists && !overrite )
    return;

  try {

    await renameFile( source, dest );

  } catch ( err ) {

    if ( err.code !== 'EXDEV' )
      throw err;

    await fileCopy( source, dest );
    await fsDelete( source );


  }

}

async function filesDelete( path, type, filterFn ) {

  const files = await fileItemize( {
    'path'     : path,
    'fileMask' : type,
    'filter'   : filterFn,
  } );

  if ( !files || !files.length )
    return;

  await Promise.all( files.map( ( file ) => fsUnlink( fsPath.join( path, file ) ) ) );

}

function filterForFileType( fileList, fileTypes, filterType = 'endswith', caseSensitive = false ) {

  if ( !fileTypes )
    return fileList;

  fileTypes = ( Array.isArray( fileTypes ) ) ? fileTypes : [fileTypes];

  if ( fileTypes.some( ( type ) => type === '*' ) )
    return fileList;

  let regex;

  const typeFilter = ( caseSensitive ) ? fileTypes.join( '|' ) : fileTypes.join( '|' ).toLowerCase();
  const list = ( caseSensitive ) ? fileList : fileList.map( ( f ) => f.toLowerCase() );

  if ( filterType === 'startswith' ) {
    regex = new RegExp( `^(${typeFilter})` );
  } else if ( filterType === 'endswith' ) {
    regex = new RegExp( `(${typeFilter})$` );
  } else {
    regex = new RegExp( `(${typeFilter})` );
  }

  const returnList = [];

  list.forEach( ( file, f ) => {

    if ( regex.test( file ) ) {
      returnList.push( fileList[f] );
    }

  } );

  return returnList;

}

function getLastPathItem( path ) {

  if ( typeof path !== 'string' )
    return null;

  const pathArr = path.split( fsPath.sep );

  return ( pathArr[pathArr.length - 1] === '' ) ?
    pathArr[pathArr.length - 2] :
    pathArr[pathArr.length - 1];

}

function getFileNameFromPath( path, sep = fsPath.sep, includeExtension = false ) {

  if ( typeof path !== 'string' )
    return null;

  const pathArr = path.split( sep );

  return ( includeExtension ) ?
    pathArr[pathArr.length - 1] :
    pathArr[pathArr.length - 1].split( '.' )[0];

}

function getFileExtension( fileName ) {
  const fParts = fileName.split( '.' );
  return `${fParts[fParts.length - 1].toLowerCase()}`;
}

function getFilePathsFromDirContents( dirContents, acc = [] ) {

  if ( dirContents.files.length )
    acc.push( ...dirContents.files.map( ( f ) => {

      return {
        'path'      : dirContents.path,
        'fileName'  : f,
        'fileType'  : fsPath.extname( f ).toLowerCase(),
        'separator' : fsPath.sep,
      };

    } ) );

  if ( !dirContents.directories.length )
    return acc;

  dirContents.directories.forEach( ( dc ) => getFilePathsFromDirContents( dc, acc ) );
  return acc;

}

async function moveFiles( sourceList, sourcePath, destination ) {

  if ( !sourceList || !sourceList.length )
    return throwOpErr( 'Cannot moveFiles - sourceList missing or empty.' );

  const dirExist = await dirMake( destination );

  if ( !dirExist )
    return throwOpErr( 'Cannot moveFiles - invalid destination path.' );

  await Promise.all(
    sourceList.map( async ( inputFile ) => {

      try {

        await renameFile(
          fsPath.join( sourcePath, inputFile ),
          fsPath.join( destination, inputFile ),
        );

      } catch ( e ) {
        throwOpErr( 'Cannot moveFiles', e, e.message );
      }

    } ),
  );

}

const openStream = ( () => {

  const streamMethods = {
    'read'  : 'createReadStream',
    'write' : 'createWriteStream',
  };

  return function openStream( streamType, path, format ) {

    if ( !path )
      throwOpErr( `Cannot open ${streamType} stream - invalid path.` );

    return new Promise( ( resolve, reject ) => {

      const filePath = ( format ) ? `${path}.${format}` : path;
      const stream = fs[streamMethods[streamType]]( filePath );

      stream.on( 'error', () => {
        throwOpErr( `Failed to open ${streamType} stream - error opening for file: ${path}.` );
      } );

      stream.on( 'open', () => {
        resolve( stream );
      } );

    } );

  };

} )();

const openReadFileStream  = ( path, format ) => openStream( 'read', path, format );
const openWriteFileStream = ( path, format ) => openStream( 'write', path, format );

async function readDirectory( path, fileMask, opts = {} ) {

  const found = await exist( path );

  if ( !found )
    return [];

  const options = {
    'includeFiles'       : true,
    'includeDirectories' : true,
    ...opts,
  };

  try {

    const contents = await readDir(
      path,
      {
        'withFileTypes' : true,
        'encoding'      : 'utf8',
      },
    );

    const results = contents.reduce( ( results, entry ) => {

      if ( !options.includeFiles && entry.isFile() )
        return results;

      if ( !options.includeDirectories && entry.isDirectory() )
        return results;

      results.push( entry.name );
      return results;

    }, [] );

    return ( fileMask ) ?
      filterForFileType( results, fileMask ) :
      results;

  } catch ( e ) {
    // SILENTLY CATCH ERRORS FROM FILESYSTEM (WE CANNOT READ SOME VOLUMES E.G., SYSTEM VOLUME IN FORMATION)
    return [];
  }

}

async function readDirectoryContents( path, fileMask, filterFN ) {

  /*
    RESOLVES TO:
    {
      'path': String,
      'directories': [String],
      'files':[String],
      'stats:[fs.Stat]
    }
  */

  const found = await exist( path );

  if ( !found )
    return {
      'path'        : path,
      'directories' : [],
      'files'       : [],
      'stats'       : [],
    };

  try {

    const contents = await readDir( path );

    if ( !contents || !contents.length )
      return {
        'path'        : path,
        'directories' : [],
        'files'       : [],
        'stats'       : [],
      };

    // READS FILE STATS FOR IMAGES - SILENTLY SWALLOWS ANY ERRORS ON FILE READS (THIS IS TO AVOID PERMISSION ERRORS ON FILES WE AREN'T ALLOWED TO READ)
    const stats = await Promise.all(
      contents.map( ( item ) => readFileStats( fsPath.join( path, item ) )
        .then( ( stat ) => ( { item, stat } ) )
        .catch( ( err ) => {} ) ),
    );

    const pathContents = stats.reduce( ( contents, fileStat ) => {

      if ( !fileStat )
        return contents;

      ( fileStat.stat.isFile() ) ?
        contents.files.push( fileStat.item ) :
        contents.directories.push( fileStat.item );

      contents.stats.push( {
        'name' : fileStat.item,
        'stat' : fileStat.stat,
      } );

      return contents;

    }, {
      'path'        : path,
      'directories' : [],
      'files'       : [],
      'stats'       : [],
    } );

    if ( fileMask ) {
      pathContents.files = filterForFileType( pathContents.files, fileMask );
      pathContents.stats = pathContents.stats.filter( ( sf ) => pathContents.files.includes( sf.name ) );
    }

    return ( filterFN ) ?
      pathContents.filter( filterFN ) :
      pathContents;


  } catch ( e ) {

    return {
      'path'        : path,
      'directories' : [],
      'files'       : [],
      'stats'       : [],
    };

  }

}

async function readFileAsText( path ) {

  try {
    const contents = await readFile( path, 'UTF-8' );
    return contents;
  } catch ( err ) {
    return null;
  }


}

async function readFileAsJSON( path ) {

  try {
    const contents = await readFile( path, { 'encoding': 'utf8' } );
    const json = JSON.parse( contents );
    return json;
  } catch ( err ) {
    return null;
  }

}

async function recurseDirectoryContents( rootPath, fileMask ) {

  const contents = await readDirectoryContents( rootPath, fileMask );

  const nextValues = {
    'path'        : contents.path,
    'directories' : [],
    'files'       : contents.files,
  };

  if ( !contents.directories.length )
    return nextValues;

  nextValues.directories = await Promise.all(
    contents.directories.map( ( dir ) => recurseDirectoryContents( fsPath.join( contents.path, dir ), fileMask ) ),
  );

  return nextValues;

}

async function writeFileAsJSON( data, path, fileName, ext = 'json' ) {

  await dirMake( path );

  return writeFile(
    fsPath.join( path, `${fileName}.${ext}` ),
    JSON.stringify( data, null, 2 ),
  )
    .catch( ( e ) => false )
    .then( () => true );

}

async function writeFileAsText( data, path, fileName ) {

  await dirMake( path );

  return writeFile(
    fsPath.join( path, fileName ),
    data,
  )
    .catch( ( e ) => false )
    .then( () => true );

}

module.exports = {
  copyFiles,
  copyFilesInBatches,
  'dirExist'      : exist,
  dirItemize,
  dirMake,
  enumerateDrives,
  EOL,
  exist,
  fileCopy,
  fileDelete,
  filesDelete,
  'fileExist'     : exist,
  fileItemize,
  'fileExtension' : getFileExtension,
  fileMove,
  'fsAppend'      : fsAppend,
  'fsMove'        : renameFile,
  'fsPath'        : fsPath,
  'fsReadDir'     : readDir,
  filterForFileType,
  getFileNameFromPath,
  getFilePathsFromDirContents,
  getLastPathItem,
  'moveFiles'     : moveFiles,
  openStream,
  openReadFileStream,
  openWriteFileStream,
  pathSeparator,
  readDirectory,
  readDirectoryContents,
  readFile,
  readFileAsText,
  readFileAsJSON,
  recurseDirectoryContents,
  renameFile,
  writeFile,
  writeFileAsText,
  writeFileAsJSON,
};
