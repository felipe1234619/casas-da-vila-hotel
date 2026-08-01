export function checkAvailability(
  villas,
  travelDates,
  inventory
) {

  if (!travelDates) {

    return {
      available: false,
      reason: "missing_dates"
    };

  }


  const results = villas.map(villaName => {


    const villa =
      inventory.villas.find(
        v => v.name === villaName
      );


    if (!villa) {

      return {

        villa: villaName,

        available:false

      };

    }


    return {

      villa: villaName,

      available:true,

      maxGuests:
        villa.maxGuests || null

    };


  });


  return {

    available:true,

    period:
      travelDates,

    villas:
      results

  };

}