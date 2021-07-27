
const { dateFromStr } = require( './helpers' );

const tableFormatters = {
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
  'table_tournament_fees': ( data, tokens ) => {

    // RE-USE table_events_schedule DATA

    return [
      'Tournament|Duration|Fee',
      '---|---|---',
      ...tokens.table_events_schedule
        .map( ( d ) => {

          return [
            `**${d.name}**`,
            d.duration,
            `${d.entryFee} per team`,
          ].join( ' | ' );

        } ),
    ].join( '\n' );


  },
  'table_events_schedule': ( data, tokens ) => {

    return [
      'Tournament|Date|Locations|Age Groups Offered|Website',
      '---|---|---|---|---',
      ...data
        .filter( ( d ) => d.isSpecialEvent )
        .map( ( d ) => {

          return [
            `**${d.name}**`,
            d.dates.join( ' <br> ' ),
            d.venues.join( ' <br> ' ),
            d.divisions.join( ', ' ),
            d.url,
          ].join( ' | ' );

        } ),
    ].join( '\n' );

  },
  'table_events_schedule_simple': ( data, tokens ) => {

    return [
      'Tournament|Date|Locations',
      '---|---|---|',
      ...tokens.table_events_schedule
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
      ...tokens.table_events_schedule
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
  'table_tournament_schedule': ( data, tokens ) => {

    const headerArray = [];
    headerArray.length = data.ageDivisions.length + 2;

    const dateOptions =
      data.dateOptions ||
      {
        'month' : 'long',
        'day'   : 'numeric',
      };

    return [
      `| |${data.ageDivisions.join( '|' )}`,
      headerArray.join( '--|' ),
      ...data.tournaments.map( ( d ) => {
        return `${d.name}|${d.dates
          .map( ( td ) => {

            const date = dateFromStr( td.date, '-' );
            return date.toLocaleDateString( 'en-US', dateOptions );

          } )
          .join( '|' )}`;
      } ),
    ].join( '\n' );

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
  'table_premierleague_cost_breakdown': ( data, tokens ) => {

    const leagueFee = tokens.fee_premierleague;
    const daysOfPlay = tokens.table_premierleague_schedule.tournaments.length;

    return tableFormatters.table_league_cost_breakdown(
      tokens,
      leagueFee,
      daysOfPlay,
    );

  },
  'table_nonleague_schedule': ( data, tokens ) => {
    return tableFormatters.table_tournament_schedule( data, tokens );
  },
  'table_premierleague_schedule': ( data, tokens ) => {
    return tableFormatters.table_tournament_schedule( data, tokens );
  },
  'table_regionchampionships_schedule': ( data, tokens ) => {
    return tableFormatters.table_tournament_schedule( data, tokens );
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
