
function throwOpErr( str ) {
  throw new Error( str );
}

function allAreTruthy( arr ) {
  return arr.every( ( item ) => !!item );
}

async function asyncIterate( array, fn ) {

  const items = [];

  if ( !Array.isArray( array ) || !array.length )
    return items;

  await array.reduce( async ( last, item, i ) => {

    await last;

    const fItem = await fn( item, i );

    if ( fItem !== undefined )
      items.push( fItem );

    return fItem;

  }, Promise.resolve() );

  return items;

}

function buildSearchTerms( values, minLength = 3 ) {

  /*
    A FUNCTION FOR RETURNING LEFT ANCHORED SEARCH TERMS
    MONGODB DOES NOT SUPPORT PARTIAL TEXT SEARCHING
    COURTESY: https://web.archive.org/web/20170609122132/http://jam.sg/blog/efficient-partial-keyword-searches/
    WITH SOME MODIFICATIONS ...
  */

  const results = [];

  const terms = ( Array.isArray( values ) ) ? values : [values];

  terms.sort().reverse().forEach( ( val ) => {

    let tmp;
    let hasSuffix;

    if ( val.length <= minLength )
      return [val.toUpperCase()];

    for ( let i = minLength; i < val.length - 2; i++ ) {

      tmp = val.substring( 0, i ).toUpperCase();
      hasSuffix = false;

      for ( let j = 0; j < results.length; j++ ) {

        if ( results[j].indexOf( tmp ) === 0 ) {
          hasSuffix = true;
          break;
        }

      }

      ( !hasSuffix ) &&
        results.push( tmp );

    }

  } );

  return results;

}

function copyProps( obj, propList ) {

  return propList.reduce( ( values, key ) => {

    if ( obj[key] !== undefined )
      values.push( obj[key] );

    return values;

  }, [] );

}

function dateFromYMD( year, month, day, hour, minute, second ) {

  if ( !allAreTruthy( [year, month, day] ) )
    throwOpErr( `${'dateFromYmd() - Incorrect Date Format. Year, month and date are required. Months should start at 1.\n'}${[year, month, day]}` );

  const date = new Date();
  date.setFullYear( parseInt( year, 10 ) );
  date.setMonth( parseInt( month, 10 ) - 1, parseInt( day, 10 ) );

  if ( hour )
    date.setHours( parseInt( hour, 10 ) );

  if ( minute )
    date.setMinutes( parseInt( minute, 10 ) );

  if ( second )
    date.setSeconds( parseInt( second, 10 ) );

  return date;

}

function dateFromStr( dateStr, delimiter = ':' ) {

  if ( !dateStr )
    throwOpErr( 'Cannot convert string to Date - missing dateStr.' );

  if ( dateStr instanceof Date )
    return new Date( dateStr.getTime() );

  const dateParts = ( dateStr.indexOf( delimiter ) > -1 ) ?
    dateStr.split( delimiter ) :
    dateStr.split( '-' );

  if ( dateParts.length < 3 )
    throwOpErr( 'Cannot convert string to Date - invalid dateStr.' );

  return dateFromYMD( ...dateParts );


}

function datefromLegacyData( data ) {

  if ( !data )
    return;

  return ( data instanceof Date ) ?
    data :
    dateFromStr( data.originalDate );

}

function dump( obj ) {
  console.log( JSON.stringify( obj, null, 2 ) );
}

function copyObjectProps( obj = {}, skipProps = [], caseSensitive = false ) {

  if ( typeof obj === 'string' || typeof obj === 'number' )
    return obj;

  if ( obj instanceof Date )
    return new Date( obj.getTime() );

  skipProps = ( skipProps instanceof Set ) ?
    skipProps :
    new Set( skipProps );

  // REMOVE A SET OF PROPERTIES, optionally filtering using skipProps
  // USEFUL FOR CREAING A NEW OBJECT FROM ANOTHER (E.G. REMOVE PARAMS FROM A QUERY BODY BEFORE PASSING IT TO A MODEL FIND FUNCTION)
  if ( Array.isArray( obj ) )
    return obj.map( ( d ) => {

      // HACK BECAUSE MONGOOSE WON'T RETURN OBJECTID AS ANYTHING BUT
      // OBJECT, EVEN WHEN USING LEAN();
      return ( d.constructor && d.constructor.name === 'ObjectId' ) ?
        d.toString() :
        copyObjectProps( d, skipProps, caseSensitive );

    } );

  return Object
    .keys( obj )
    .filter( ( key ) => !skipProps.has( ( caseSensitive ) ? key : key.toLowerCase() ) )
    .reduce( ( r, key ) => {

      if ( obj[key] === null ) {
        r[key] = null;
        return r;
      }

      if ( Array.isArray( obj[key] ) ) {
        r[key] = obj[key].map( ( d ) => {

          // HACK BECAUSE MONGOOSE WON'T RETURN OBJECTID AS ANYTHING BUT
          // OBJECT, EVEN WHEN USING LEAN();
          return ( d.constructor && d.constructor.name === 'ObjectId' ) ?
            d.toString() :
            copyObjectProps( d, skipProps, caseSensitive );

        } );
        return r;
      }

      if ( typeof obj[key] === 'object' ) {
        r[key] = copyObjectProps( obj[key], skipProps, caseSensitive );
        return r;
      }

      r[key] = obj[key];
      return r;

    }, {} );

}

function deepCopyDataObject( obj ) {

  /*
  THIS IS A SIMPLE, NAIVE FUNCTION FOR COPYING A DATA OBJECT
  FUNCTIONS ARE COPIED BY REFERENCE

  DOES NOT COPY PROTOTYPE, JUST COPIES PROPS
  */

  // PRIMITIVE VALUES
  if ( typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean' )
    return obj;

  // NULL/UNDEFINED VALUE
  if ( obj === null || obj === undefined )
    return obj;

  // PROMISE
  if ( obj instanceof Promise || ( obj.then && typeof obj.then === 'function' ) )
    return obj;

  // METHOD
  if ( typeof obj === 'function' )
    return obj;

  if ( obj instanceof Date )
    return new Date( obj.getTime() );

  if ( Array.isArray( obj ) )
    return obj.map( ( elem ) => deepCopyDataObject( elem ) );

  if ( obj instanceof Map ) {
    const map = new Map();
    obj.forEach( ( v, k ) => map.set( k, deepCopyDataObject( v ) ) );
    return map;
  }

  if ( obj instanceof Set ) {
    const set = new Set();
    obj.forEach( ( v ) => set.add( deepCopyDataObject( v ) ) );
    return set;
  }

  // NORMAL OBJECT
  return Object.keys( obj ).reduce( ( copy, key ) => {
    copy[key] = deepCopyDataObject( obj[key] );
    return copy;
  }, {} );

}

const fieldsToRemove = { 'createdAt': 0, 'updatedAt': 0, '__v': 0 };

function findByProp( list, propName, value ) {
  return list.find( ( item ) => item[propName] === value );
}

function flattenObject( src = {}, dest = {}, prefix = '' ) {

  return Object
    .keys( src )
    .reduce( ( ret, k ) => {

      const prop = ( prefix ) ? `${prefix}.${k}` : k;

      if ( src[k] instanceof Date || src[k] instanceof Map || src[k] instanceof Set ) {
        ret[prop] = src[k];
        return ret;
      }

      ( typeof src[k] === 'object' && src[k] !== null && !Array.isArray( src[k] ) ) ?
        flattenObject( src[k], dest, prop ) :
        ret[prop] = src[k];

      return ret;

    }, dest );

}

function formatNumbers( input ) {

  Object
    .keys( input )
    .filter( ( k ) => k.startsWith( 'fee_' ) )
    .forEach( ( k ) => {

      const parts = input[k].toFixed( 2 ).split( '.' );
      input[`${k}_formatted`] =  `$${parts[0]}^.${parts[1]}^`;

    } );

}

const getFirstLetter = ( () => {

  /* RETURN FIRST LETTER OF FIRST WORD, SKIPPING A, AN OR THE */

  const prefixes = ['a', 'an', 'the'];

  return ( str ) => {

    const arr = str.split( ' ' );

    return ( prefixes.indexOf( arr[0].toLowerCase() ) > -1 ) ?
      arr[1][0].toUpperCase() :
      arr[0][0].toUpperCase();

  };

} )();

const getPropertyValue = ( () => {

  function getProp( obj, props, defaultValue ) {

    const prop = props.shift();

    if ( !obj[prop] )
      return defaultValue;

    return ( props.length === 0 ) ?
      obj[prop] :
      getProp( obj[prop], props, defaultValue );

  }

  return function getPropertyValue( obj, props, defaultValue ) {

    if ( !obj || !props || !props.length )
      return defaultValue;

    return ( Array.isArray( obj ) ) ?
      getProp( obj, props, defaultValue ) :
      getProp( obj, props.split( '.' ), defaultValue );

  };


} )();

function isNumber( val ) {

  return ( val === undefined || val === null || val === '' || Array.isArray( val ) ) ?
    false :
    !Number.isNaN( Number( val ) );

}

function makeMap( input, keyProp = '_id', valueProp ) {

  // CREATE LOOKUP MAP FOR EASY REFERENCE
  if ( !input || !input.length )
    return new Map();

  return input.reduce( ( acc, i ) => {

    const key = ( keyProp === '_id' ) ?
      i._id.toString() :
      i[keyProp];

    const value = ( valueProp ) ?
      i[valueProp] :
      i;

    acc.set( key, value );

    return acc;

  }, new Map() );

}

function padNumberAsCounter( num, length = 4 ) {
  return num.toString().padStart( length, '0' );
}

async function executeInSegments( input, fn ) {

  // A SIMPLE, RECURSIVE FUNCTION FOR BREAKING EXECUTION INTO SEGMENTS
  // EXPECTS AN INPUT ARRAY AND A FUNCTION

  if ( !Array.isArray( input ) || !input.length || typeof fn !== 'function' )
    return;

  const [
    segment,
    ...remaining
  ] = input;

  await fn( segment );
  await setImmediate( () => Promise.resolve() );
  return executeInSegments( remaining, fn );

}

function wrapAsArray( input ) {
  return ( Array.isArray( input ) ) ?
    input : [input];
}

function someAreTruthy( arr ) {
  return arr.some( ( item ) => !!item );
}

const sort = ( () => {

  function byNumber( a, b, prop ) {

    return ( prop !== undefined ) ?
      a[prop] - b[prop] :
      a - b;

  }

  function byString( a, b, prop ) {

    let valA;
    let valB;

    if ( prop !== undefined ) {
      valA = a[prop] || '';
      valB = b[prop] || '';
      valA = valA.toString().toUpperCase();
      valB = valB.toString().toUpperCase();
    } else {
      valA = a.toString().toUpperCase();
      valA = b.toString().toUpperCase();
    }

    return valA.localeCompare( valB );

  }

  function lexicographic( a, b, prop ) {

    let aVal;
    let bVal;

    if ( prop === undefined ) {
      aVal = a;
      bVal = b;
    } else {
      aVal = a[prop];
      bVal = b[prop];
    }

    const minLen = Math.min( aVal.length, bVal.length );

    const aStr = aVal.substr( 0, minLen );
    const bStr = bVal.substr( 0, minLen );

    const result = aStr.localeCompare( bStr );

    if ( result < 0 )
      return -1;

    if ( result > 0 )
      return 1;

    return 0;

  }

  return { byNumber, byString, lexicographic };

} )();

function splitArray( arr, size ) {

  if ( !Array.isArray( arr ) )
    throwOpErr( 'splitArray - failed. Input must be an array.' );

  if ( !size || size < 1 )
    throwOpErr( 'splitArray - failed. Batch size must be a number greater than 1.' );

  const acc = [];
  const toCopy = [...arr];

  while ( toCopy.length > 0 ) {

    const batch = ( toCopy.length < size ) ?
      toCopy.splice( 0, toCopy.length ) :
      toCopy.splice( 0, size );

    acc.push( batch );

  }

  return acc;

}

function stripLeadingChars( str, char ) {

  return ( str[0] === char ) ?
    stripLeadingChars( str.substring( 1 ), char ) :
    str;


}

function stripTrailingChars( str, char ) {

  return ( str[str.length - 1] === char ) ?
    stripTrailingChars( str.substring( 0, str.length - 1 ), char ) :
    str;

}

function stripValues( obj, toStrip = [undefined, null, ''] ) {

  // MEANT TO FILTER PROPERTIES WITH CERTAIN VALUES OUT OF AN OBJECT
  // ONLY INTENDED FOR USE ON SIMPLE JSON FORMATTED OBJECTS

  return Object.keys( obj ).reduce( ( ret, k ) => {

    if ( Array.isArray( obj[k] ) ) {
      ret[k] = obj[k].map( ( v ) => stripValues( v, toStrip ) );
      return ret;
    }

    // CHECK HERE BEFORE TYPEOF CHECK BECAUSE NULL IS AN OBJECT!
    if ( toStrip.indexOf( obj[k] ) > -1 )
      return ret;

    if ( typeof obj[k] === 'object' ) {
      ret[k] = stripValues( obj[k], toStrip );
      return ret;
    }

    ret[k] = obj[k].toString();
    return ret;

  }, {} );

}

function uniqueFromArray( arr ) {

  const set = new Set( arr );
  return [...set];

}

function uniqueFromArrayByProp( arr = [], prop ) {

  return [...arr.reduce( ( acc, item ) => {

    if ( item.hasOwnProperty( prop ) )
      acc.set( item[prop], item );

    return acc;

  }, new Map() ).values()];

}

function validateEvery( fnArr ) {
  return function validateEvery( v ) {
    return fnArr.every( ( fn ) => fn( v ) );
  };
}

function validateSome( fnArr ) {
  return function validateSome( v ) {
    return fnArr.some( ( fn ) => fn( v ) );
  };
}


exports.allAreTruthy  = allAreTruthy;
exports.asyncIterate = asyncIterate;
exports.buildSearchTerms = buildSearchTerms;
exports.splitArray = splitArray;
exports.copyProps = copyProps;
exports.datefromLegacyData = datefromLegacyData;
exports.dateFromStr = dateFromStr;
exports.dateFromYMD = dateFromYMD;
exports.deepCopyDataObject = deepCopyDataObject;
exports.dump = dump;
exports.executeInSegments = executeInSegments;
exports.fieldsToRemove = fieldsToRemove;
exports.copyObjectProps = copyObjectProps;
exports.findByProp = findByProp;
exports.flattenObject = flattenObject;
exports.formatNumbers = formatNumbers;
exports.getFirstLetter = getFirstLetter;
exports.getPropertyValue = getPropertyValue;
exports.isNumber = isNumber;
exports.makeMap = makeMap;
exports.padNumberAsCounter = padNumberAsCounter;
exports.someAreTruthy = someAreTruthy;
exports.sort = sort;
exports.stripLeadingChars = stripLeadingChars;
exports.stripTrailingChars = stripTrailingChars;
exports.stripValues = stripValues;
exports.throwOpErr = throwOpErr;
exports.uniqueFromArray = uniqueFromArray;
exports.uniqueFromArrayByProp = uniqueFromArrayByProp;
exports.validateEvery = validateEvery;
exports.validateSome = validateSome;
exports.wrapAsArray = wrapAsArray;
