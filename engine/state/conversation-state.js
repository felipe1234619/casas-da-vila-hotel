import fs from "fs";
import path from "path";


const stateFile = path.join(
  process.cwd(),
  "engine/state/conversation_state.json"
);



function ensureStateFile() {

  if (!fs.existsSync(stateFile)) {

    fs.writeFileSync(
      stateFile,
      JSON.stringify(
        {},
        null,
        2
      )
    );

  }

}



function loadConversationState() {

  ensureStateFile();


  try {

    return JSON.parse(
      fs.readFileSync(
        stateFile,
        "utf8"
      )
    );

  } catch(error) {

    return {};

  }

}




function saveConversationState(state) {

  ensureStateFile();


  fs.writeFileSync(

    stateFile,

    JSON.stringify(
      state,
      null,
      2
    )

  );

}




export function updateConversationState(
  sessionId,
  data
) {


  const states =
    loadConversationState();



  states[sessionId] = {

    ...(states[sessionId] || {}),

    ...data,

    updated_at:
      new Date().toISOString()

  };



  saveConversationState(states);



  return states[sessionId];

}




export function getConversationState(
  sessionId
) {


  const states =
    loadConversationState();



  return states[sessionId] || {};

}