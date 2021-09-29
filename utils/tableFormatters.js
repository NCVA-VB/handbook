
const { dateFromStr, wrapAsArray } = require( './helpers' );

function tournamentRow( input, dateOptions, includeLocation = true ) {

  const dates = input.dates
    .map( ( td ) => {

      const dates = wrapAsArray( td.date ).map( ( d ) => {

        const date = dateFromStr( d, '-' );
        return date.toLocaleDateString( 'en-US', dateOptions );

      } );

      return `${dates.join( ' / ' )}`;

    } )
    .join( ' | ' );

  return ( includeLocation ) ?
    `| ${input.name} | ${dates}\n${locationsRow( input )}` :
    `| ${input.name} | ${dates}`;

}

function locationsRow( input ) {

  const locations = input.dates
    .map( ( td ) => {
      return td.location;
    } )
    .join( ' | ' );

  return `| |${locations}`;


}

function reduceToUniqueTournaments( data ) {

  const tMap = data.reduce( ( m, t ) => {

    m.set( t.name, t );
    return m;

  }, new Map() );

  return [...tMap.values()];

}

const tableFormatters = {
  'table_events_schedule': ( data, tokens ) => {

    return [
      'Tournament|Date|Locations|Divisions|Website',
      '---|---|---|---|---',
      ...tokens.events_schedule
        .filter( ( d ) => d.isSpecialEvent )
        .map( ( d ) => {

          return [
            `**${d.name}**`,
            d.dates.join( ' <br> ' ),
            d.venues.join( ' <br> ' ),
            // `<ul>${d.divisions.map( ( d ) => `<li>${d}</li>` ).join( ' ' )}</ul>`,
            d.divisions.join( ' <br> ' ),
            d.url,
          ].join( ' | ' );

        } ),
    ].join( '\n' );

  },
  'table_events_schedule_simple': ( data, tokens ) => {

    return [
      'Tournament|Date|Locations',
      '---|---|---|',
      ...tokens.events_schedule
        .filter( ( d ) => d.isSpecialEvent )
        .map( ( d ) => {

          return [
            `**${d.name}**`,
            d.dates.join( ' <br> ' ),
            d.venues.join( ' <br> ' ),
          ].join( ' | ' );

        } ),
    ].join( '\n' );

  },
  'table_events_schedule_website': ( data, tokens ) => {

    return [
      'Tournament|Date|Locations|Entry Fee',
      '---|---|---|--|',
      ...tokens.events_schedule
        .filter( ( d ) => d.isSpecialEvent )
        .map( ( d ) => {

          return [
            `**${d.name}**`,
            d.dates.join( ' <br> ' ),
            d.venues.join( ' <br> ' ),
            d.entryFee,
          ].join( ' | ' );

        } ),
    ].join( '\n' );


  },
  'table_league_cost_breakdown': ( tokens, leagueFee, daysOfPlay ) => {

    const memberShipFee = tokens.fee_membership_full;

    return [
      '| No. of Players | Event Cost Per Player | Player Fee | Total Cost Per Player | Cost Per Player Per Day |',
      '|---|---|---|---|---|',
      ...[10, 12, 15].map( ( count ) => {

        const costPerPlayer = leagueFee / count;
        const totalPlayerCost = costPerPlayer + memberShipFee;

        return [
          count,
          `$${costPerPlayer.toFixed( 2 )}`,
          `$${memberShipFee.toFixed( 2 )}`,
          `$${totalPlayerCost.toFixed( 2 )}`,
          `$${( totalPlayerCost / daysOfPlay ).toFixed( 2 )}`,
        ].join( '|' );

      } ),
    ].join( '\n' );

  },
  'table_nonleague_schedule': ( data, tokens ) => {
    return tableFormatters.table_tournament_schedule( data, tokens );
  },
  'table_powerleague_cost_breakdown': ( data, tokens ) => {

    const plFee = tokens.fee_powerleague;
    const daysOfPlay = tokens.table_powerleague_schedule.tournaments.length;

    return tableFormatters.table_league_cost_breakdown(
      tokens,
      plFee,
      daysOfPlay,
    );


  },
  'table_powerleague_schedule': ( data, tokens ) => {
    return tableFormatters.table_tournament_schedule( data, tokens );
  },
  'table_powerleague_schedule_with_locations': ( data, tokens ) => {
    return tableFormatters.table_tournament_schedule_with_locations( tokens.table_powerleague_schedule, tokens );

  },
  'table_premierleague_cost_breakdown': ( data, tokens ) => {

    const leagueFee = tokens.fee_premierleague;
    const daysOfPlay = tokens.table_premierleague_schedule.tournaments.length;

    return tableFormatters.table_league_cost_breakdown(
      tokens,
      leagueFee,
      daysOfPlay,
    );

  },
  'table_premierleague_schedule': ( data, tokens ) => {
    return tableFormatters.table_tournament_schedule( data, tokens );
  },
  'table_premierleague_schedule_with_locations': ( data, tokens ) => {
    return tableFormatters.table_tournament_schedule_with_locations( tokens.table_premierleague_schedule, tokens );

  },
  'table_regionchampionships_schedule': ( data, tokens ) => {
    return tableFormatters.table_tournament_schedule( data, tokens );
  },
  'table_specialevent_fliers': ( data, tokens ) => {

    const tournaments = reduceToUniqueTournaments( tokens.events_schedule );

    return tournaments
      .filter( ( t ) => !!t.urlFlier || !!t.url )
      .map( ( t ) => {

        return `<div class="tournamentflier">\r\n\r\n<a href="${t.url}" target="_blank"><img src="${t.urlFlier}" alt="${t.name}"></a>\r\n\r\n</div>`;

      } ).join( '\r\n\r\n' );

  },
  'table_tournament_fees': ( data, tokens ) => {

    // RE-USE events_schedule DATA
    // REDUCE DOWN TO UNIQUE TOURNAMENT NAMES TO FILTER DOUBLE WEEKEND EVENTS, E.G. FAR WESTERNS
    const tournaments = reduceToUniqueTournaments( tokens.events_schedule );

    return [
      'Tournament|Duration|Fee',
      '---|---|---',
      ...tournaments
        .map( ( d ) => {

          return [
            `**${d.name}**`,
            d.duration,
            `${d.entryFee} per team`,
          ].join( ' | ' );

        } ),
    ].join( '\n' );

  },
  'table_tournament_schedule': ( data, tokens ) => {

    const headerArray = [];
    headerArray.length = data.ageDivisions.length + 2;

    const dateOptions =
      data.dateOptions ||
      {
        'month' : 'long',
        'day'   : 'numeric',
      };

    const includeLocations = false;

    return [
      `| |${data.ageDivisions.join( '|' )}`,
      headerArray.join( '--|' ),
      ...data.tournaments.map( ( td ) => tournamentRow( td, dateOptions, includeLocations ) ),
    ].join( '\n' );

  },
  'table_tournament_schedule_with_results': ( data, tokens ) => {

    const headerArray = [];
    headerArray.length = data.ageDivisions.length + 2;

    const dateOptions =
      data.dateOptions ||
      {
        'month' : 'long',
        'day'   : 'numeric',
      };

    const includeLocations = false;

    return [
      `| |${data.ageDivisions.join( '|' )}`,
      headerArray.join( ':--:|' ),
      ...data.tournaments.map( ( td ) => tournamentRowWithResults( td, dateOptions, includeLocations ) ),
    ].join( '\n' );
  },
  'table_tournament_schedule_with_locations': ( data, tokens ) => {

    const headerArray = [];
    headerArray.length = data.ageDivisions.length + 2;

    const dateOptions =
      data.dateOptions ||
      {
        'month' : 'long',
        'day'   : 'numeric',
      };

    const includeLocations = true;

    return [
      `| |${data.ageDivisions.join( '|' )}`,
      headerArray.join( '--|' ),
      ...data.tournaments.map( ( td ) => tournamentRow( td, dateOptions, includeLocations ) ),
    ].join( '\n' );

  },
  'table_usavage_definition': ( data, tokens ) => {

    const headerArray = [];
    headerArray.length = data.ageHeaders.length + 2;

    return [
      `| |${data.ageHeaders.join( '|' )}`,
      headerArray.join( '--|' ),
      ...data.ages.reduce( ( acc, age ) => {

        const rows = age.months.reduce( ( rows, month ) => {

          rows.push( `${month}|${age.years.join( '|' )}` );
          return rows;

        }, [] );

        acc.push( ...rows );
        return acc;

      }, [] ),
    ].join( '\n' );



  },
  'table_youthleague_fallcompetition_schedule': ( data, tokens ) => {
    return tableFormatters.table_tournament_schedule( data, tokens );
  },
  'table_youthleague_springcompetition_schedule': ( data, tokens ) => {
    return tableFormatters.table_tournament_schedule( data, tokens );
  },
};

module.exports = { tableFormatters };
