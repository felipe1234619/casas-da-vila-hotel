export function buildConversationContext(memory = {}) {


  return {


    guest_profile:
      memory.profile
      ||
      null,


    recommended_villas:
      memory.recommended_villas
      ||
      [],


    travel_dates:
      memory.travel_dates
      ||
      null,


    guests:
      memory.guests
      ||
      null,


    trip_type:
      memory.trip_type
      ||
      null,


    sales_stage:
      memory.sales_stage
      ||
      "new_lead"


  };


}