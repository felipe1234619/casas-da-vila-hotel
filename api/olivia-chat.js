import fs from "fs";
import path from "path";

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }


  try {

    let body = req.body;


    if (!body) {

      let raw = "";

      await new Promise((resolve) => {

        req.on("data", (chunk) => {
          raw += chunk;
        });

        req.on("end", resolve);

      });


      body = raw ? JSON.parse(raw) : {};

    }


    const message = body.message || "";


    const inventory = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          "knowledge/inventory.json"
        ),
        "utf8"
      )
    );


    const playbook = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          "behavior/conversation_playbook.json"
        ),
        "utf8"
      )
    );


    return res.status(200).json({

      ok: true,

      assistant: "Olivia",

      received_message: message,

      knowledge_loaded: true,

      behavior_loaded: true,

      inventory_villas: inventory.villas.length

    });


  } catch(error) {

    return res.status(500).json({

      error: error.message

    });

  }

}