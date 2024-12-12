import JSZip from "jszip";
import pkcs12 from "./PKCS12";
import xml2js from "xml2js";
import { promises as fs } from "fs";
import { SetApiConfig } from "./type.interface.";
import { Worker } from "worker_threads";
import https from "https";
import axios from "axios";

class SET {
  private cert: any;
  private key: any;

  abrir(certificado: any, passphase: string) {
    pkcs12.openFile(certificado, passphase);
    this.cert = pkcs12.getCertificate();
    this.key = pkcs12.getPrivateKey();
  }

  async consulta(
    id: number,
    cdc: string,
    env: "test" | "prod",
    certificado: any,
    passphase: any,
    config?: SetApiConfig
  ): Promise<any> {
    let defaultConfig: SetApiConfig = {
      debug: false,
      timeout: 90000,
    };

    defaultConfig = Object.assign(defaultConfig, config);

    this.abrir(certificado, passphase);

    let url = "https://sifen.set.gov.py/de/ws/consultas/consulta.wsdl";
    if (env == "test") {
      url = "https://sifen-test.set.gov.py/de/ws/consultas/consulta.wsdl";
    }

    if (!this.cert) {
      throw new Error("Antes debe Autenticarse");
    }

    if (!this.key) {
      throw new Error("Antes debe autenticarse");
    }

    const httpsAgent = new https.Agent({
      cert: Buffer.from(this.cert, "utf8"),
      key: Buffer.from(this.key, "utf8"),
    });

    let soapXMLData = `<?xml version="1.0" encoding="UTF-8"?>\n\
                        <env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope">\n\
                            <env:Header/>\n\
                            <env:Body>\n\
                                <rEnviConsDeRequest xmlns="http://ekuatia.set.gov.py/sifen/xsd">\n\
                                  <dId>${id}</dId>\n\
                                  <dCDC>${cdc}</dCDC>\n\
                                </rEnviConsDeRequest>\n\
                            </env:Body>\n\
                        </env:Envelope>\n`;
    soapXMLData = this.normalizeXML(soapXMLData);

    if (defaultConfig.debug === true) {
      console.log("soapXMLData", soapXMLData);
    }
    if (defaultConfig.saveRequestFile) {
      await fs.writeFile(defaultConfig.saveRequestFile, soapXMLData);
    }

    try {
      const respuestaSuccess = await axios.post(`${url}`, soapXMLData, {
        headers: {
          "User-Agent": "facturaSend",
          "Content-Type": "application/xml; charset=utf-8",
        },
        httpsAgent,
        timeout: defaultConfig.timeout,
      });

      if (respuestaSuccess.status == 200) {
        if ((respuestaSuccess.data + "").startsWith("<?xml")) {
          var parser = new xml2js.Parser({ explicitArray: false });
          const result = await parser.parseStringPromise(respuestaSuccess.data);
          const resultData = result["env:Envelope"]["env:Body"];
          resultData.id = id;
          return resultData;
        } else {
          if ((respuestaSuccess.data + "").startsWith("<html>")) {
            throw new Error("Error de la SET BIG-IP logout page");
          } else {
            throw new Error(respuestaSuccess.data + "");
          }
        }
      } else {
        throw new Error("Error de conexión con la SET");
      }
    } catch (err: any) {
      if (err && err.response && err.response.data) {
        var xmlResponse = err.response.data;
        var parser = new xml2js.Parser({ explicitArray: false });
        try {
          const result = await parser.parseStringPromise(xmlResponse);
          const resultData = result["env:Envelope"]["env:Body"];
          resultData.id = id;
          return resultData;
        } catch (error) {
          throw error;
        }
      } else {
        throw err;
      }
    }
  }

  /**
   * Consulta un lote en la SET (Método sin uso, se deja comentado)
   */
  async consultaLote2222(
    id: number,
    numeroProtocolo: number,
    env: "test" | "prod",
    certificado: any,
    passphase: any,
    config?: SetApiConfig
  ): Promise<any> {
    let defaultConfig: SetApiConfig = {
      debug: false,
      timeout: 90000,
    };

    defaultConfig = Object.assign(defaultConfig, config);

    let url = "https://sifen.set.gov.py/de/ws/consultas/consulta-lote.wsdl";
    if (env == "test") {
      url = "https://sifen-test.set.gov.py/de/ws/consultas/consulta-lote.wsdl";
    }

    let soapXMLData = `<env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope">\n\
                            <env:Header/>\n\
                            <env:Body>\n\
                                <rEnviConsLoteDe xmlns="http://ekuatia.set.gov.py/sifen/xsd">\n\
                                    <dId>${id}</dId>\n\
                                    <dProtConsLote>${numeroProtocolo}</dProtConsLote>\n\
                                </rEnviConsLoteDe>\n\
                            </env:Body>\n\
                        </env:Envelope>\n`;

    soapXMLData = this.normalizeXML(soapXMLData);

    if (defaultConfig.debug === true) {
      console.log("soapXMLData", soapXMLData);
    }

    if (defaultConfig.saveRequestFile) {
      await fs.writeFile(defaultConfig.saveRequestFile, soapXMLData);
    }

    // Usa worker
    const runService = (WorkerData: any) => {
      return new Promise((resolve, reject) => {
        const worker = new Worker("./workerConsultaLote", {
          workerData: {
            url,
            soapXMLData,
            certificado,
            passphase,
            id,
            timeout: defaultConfig.timeout,
            path: "./workerConsultaLote.ts",
          },
        });

        worker.on("message", resolve);
        worker.on("error", reject);
        worker.on("exit", (code) => {
          if (code !== 0) reject(new Error(`stopped with ${code} exit code`));
        });
      });
    };

    try {
      const result = await runService("hello node.js");
      console.log(result);
      return result;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  /**
   * Consulta un lote en la SET
   */
  async consultaLote(
    id: number,
    numeroProtocolo: number,
    env: "test" | "prod",
    certificado: any,
    passphase: any,
    config?: SetApiConfig
  ): Promise<any> {
    let defaultConfig: SetApiConfig = {
      debug: false,
      timeout: 90000,
    };

    defaultConfig = Object.assign(defaultConfig, config);

    this.abrir(certificado, passphase);

    let url = "https://sifen.set.gov.py/de/ws/consultas/consulta-lote.wsdl";
    if (env == "test") {
      url = "https://sifen-test.set.gov.py/de/ws/consultas/consulta-lote.wsdl";
    }

    if (!this.cert) {
      throw new Error("Antes debe Autenticarse");
    }

    if (!this.key) {
      throw new Error("Antes debe autenticarse");
    }

    const httpsAgent = new https.Agent({
      cert: Buffer.from(this.cert, "utf8"),
      key: Buffer.from(this.key, "utf8"),
    });

    let soapXMLData = `<env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope">\n\
                            <env:Header/>\n\
                            <env:Body>\n\
                                <rEnviConsLoteDe xmlns="http://ekuatia.set.gov.py/sifen/xsd">\n\
                                    <dId>${id}</dId>\n\
                                    <dProtConsLote>${numeroProtocolo}</dProtConsLote>\n\
                                </rEnviConsLoteDe>\n\
                            </env:Body>\n\
                        </env:Envelope>\n`;

    soapXMLData = this.normalizeXML(soapXMLData);

    if (defaultConfig.debug === true) {
      console.log("soapXMLData", soapXMLData);
    }

    if (defaultConfig.saveRequestFile) {
      await fs.writeFile(defaultConfig.saveRequestFile, soapXMLData);
    }

    try {
      const respuestaSuccess = await axios.post(`${url}`, soapXMLData, {
        headers: {
          "User-Agent": "facturaSend",
          "Content-Type": "application/xml; charset=utf-8",
        },
        httpsAgent,
        timeout: defaultConfig.timeout,
      });

      var parser = new xml2js.Parser({ explicitArray: false });
      if (respuestaSuccess.status == 200) {
        if ((respuestaSuccess.data + "").startsWith("<?xml")) {
          const result = await parser.parseStringPromise(respuestaSuccess.data);
          const resultData = JSON.parse(
            JSON.stringify(result["env:Envelope"]["env:Body"])
          );
          resultData.id = id;
          return resultData;
        } else {
          if ((respuestaSuccess.data + "").startsWith("<html>")) {
            throw new Error("Error de la SET BIG-IP logout page");
          } else {
            throw new Error(respuestaSuccess.data + "");
          }
        }
      } else {
        throw new Error("Error de conexión con la SET");
      }
    } catch (err: any) {
      if (err && err.response && err.response.data) {
        var xmlResponse = err.response.data;
        var parser = new xml2js.Parser({ explicitArray: false });
        try {
          const result = await parser.parseStringPromise(xmlResponse);
          return result["env:Envelope"]["env:Body"];
        } catch (error) {
          throw error;
        }
      } else {
        throw err;
      }
    }
  }

  async consultaRUC(
    id: number,
    ruc: string,
    env: "test" | "prod",
    certificado: any,
    passphase: any,
    config?: SetApiConfig
  ): Promise<any> {
    let defaultConfig: SetApiConfig = {
      debug: false,
      timeout: 90000,
    };

    defaultConfig = Object.assign(defaultConfig, config);

    this.abrir(certificado, passphase);

    let url = "https://sifen.set.gov.py/de/ws/consultas/consulta-ruc.wsdl";
    if (env == "test") {
      url = "https://sifen-test.set.gov.py/de/ws/consultas/consulta-ruc.wsdl";
    }

    if (!this.cert) {
      throw new Error("Antes debe Autenticarse");
    }

    if (!this.key) {
      throw new Error("Antes debe autenticarse");
    }

    const httpsAgent = new https.Agent({
      cert: Buffer.from(this.cert, "utf8"),
      key: Buffer.from(this.key, "utf8"),
    });

    let soapXMLData = `<env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope">\n\
                            <env:Header/>\n\
                            <env:Body>\n\
                                <rEnviConsRUC xmlns="http://ekuatia.set.gov.py/sifen/xsd">\n\
                                    <dId>${id}</dId>\n\
                                    <dRUCCons>${ruc}</dRUCCons>\n\
                                </rEnviConsRUC>\n\
                            </env:Body>\n\
                        </env:Envelope>\n`;
    soapXMLData = this.normalizeXML(soapXMLData);

    if (defaultConfig.debug === true) {
      console.log("soapXMLData", soapXMLData);
    }

    if (defaultConfig.saveRequestFile) {
      await fs.writeFile(defaultConfig.saveRequestFile, soapXMLData);
    }

    try {
      const respuestaSuccess = await axios.post(`${url}`, soapXMLData, {
        headers: {
          "User-Agent": "facturaSend",
          "Content-Type": "application/xml; charset=utf-8",
        },
        httpsAgent,
        timeout: defaultConfig.timeout,
      });

      var parser = new xml2js.Parser({ explicitArray: false });
      if (respuestaSuccess.status == 200) {
        if ((respuestaSuccess.data + "").startsWith("<?xml")) {
          const result = await parser.parseStringPromise(respuestaSuccess.data);
          const resultData = result["env:Envelope"]["env:Body"];
          resultData.id = id;
          return resultData;
        } else {
          if ((respuestaSuccess.data + "").startsWith("<html>")) {
            throw new Error("Error de la SET BIG-IP logout page");
          } else {
            throw new Error(respuestaSuccess.data + "");
          }
        }
      } else {
        throw new Error("Error de conexión con la SET");
      }
    } catch (err: any) {
      if (err && err.response && err.response.data) {
        var xmlResponse = err.response.data;
        var parser = new xml2js.Parser({ explicitArray: false });
        try {
          const result = await parser.parseStringPromise(xmlResponse);
          const resultData = result["env:Envelope"]["env:Body"];
          resultData.id = id;
          return resultData;
        } catch (error) {
          throw error;
        }
      } else {
        throw err;
      }
    }
  }

  async recibe(
    id: number,
    xml: string,
    env: "test" | "prod",
    certificado: any,
    passphase: any,
    config?: SetApiConfig
  ): Promise<any> {
    let defaultConfig: SetApiConfig = {
      debug: false,
      timeout: 90000,
    };

    defaultConfig = Object.assign(defaultConfig, config);

    this.abrir(certificado, passphase);

    let url = "https://sifen.set.gov.py/de/ws/sync/recibe.wsdl";
    if (env == "test") {
      url = "https://sifen-test.set.gov.py/de/ws/sync/recibe.wsdl";
    }

    if (!this.cert) {
      throw new Error("Antes debe Autenticarse");
    }

    if (!this.key) {
      throw new Error("Antes debe autenticarse");
    }

    const httpsAgent = new https.Agent({
      cert: Buffer.from(this.cert, "utf8"),
      key: Buffer.from(this.key, "utf8"),
    });

    xml = xml.split("\n").slice(1).join("\n"); // Retirar <xml>

    let soapXMLData = `<?xml version="1.0" encoding="UTF-8"?>\n\
                        <env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope">\n\
                            <env:Header/>\n\
                            <env:Body>\n\
                                <rEnviDe xmlns="http://ekuatia.set.gov.py/sifen/xsd">\n\
                                    <dId>${id}</dId>\n\
                                    <xDE>${xml}</xDE>\n\
                                </rEnviDe>\n\
                            </env:Body>\n\
                        </env:Envelope>\n`;

    soapXMLData = this.normalizeXML(soapXMLData);

    if (defaultConfig.debug === true) {
      console.log("url", url, "soapXMLData", soapXMLData);
    }
    if (defaultConfig.saveRequestFile) {
      await fs.writeFile(defaultConfig.saveRequestFile, soapXMLData);
    }

    try {
      const respuestaSuccess = await axios.post(`${url}`, soapXMLData, {
        headers: {
          "User-Agent": "facturaSend",
          "Content-Type": "application/xml; charset=utf-8",
        },
        httpsAgent,
        timeout: defaultConfig.timeout,
      });

      var parser = new xml2js.Parser({ explicitArray: false });
      if (respuestaSuccess.status == 200) {
        if ((respuestaSuccess.data + "").startsWith("<?xml")) {
          const result = await parser.parseStringPromise(respuestaSuccess.data);
          const resultData = result["env:Envelope"]["env:Body"];
          resultData["id"] = id;
          return resultData;
        } else {
          if ((respuestaSuccess.data + "").startsWith("<html>")) {
            throw new Error("Error de la SET BIG-IP logout page");
          } else {
            throw new Error(respuestaSuccess.data + "");
          }
        }
      } else {
        throw new Error("Error de conexión con la SET");
      }
    } catch (err: any) {
      if (err && err.response && err.response.data) {
        var xmlResponse = err.response.data;
        var parser = new xml2js.Parser({ explicitArray: false });
        try {
          const result = await parser.parseStringPromise(xmlResponse);
          const resultData = result["env:Envelope"]["env:Body"];
          resultData["id"] = id;
          return resultData;
        } catch (error) {
          throw error;
        }
      } else {
        throw err;
      }
    }
  }

  async recibeLote(
    id: number,
    xmls: string[],
    env: "test" | "prod",
    certificado: any,
    passphase: any,
    config?: SetApiConfig
  ): Promise<any> {
    let defaultConfig: SetApiConfig = {
      debug: false,
      timeout: 90000,
    };

    defaultConfig = Object.assign(defaultConfig, config);

    this.abrir(certificado, passphase);

    if (xmls.length == 0) {
      throw new Error(
        "No se envió datos en el array de Documentos electrónicos XMLs"
      );
    }
    if (xmls.length > 50) {
      throw new Error(
        "Sólo se permiten un máximo de 50 Documentos electrónicos XML por lote"
      );
    }

    let url = "https://sifen.set.gov.py/de/ws/async/recibe-lote.wsdl";
    if (env == "test") {
      url = "https://sifen-test.set.gov.py/de/ws/async/recibe-lote.wsdl";
    }

    if (!this.cert) {
      throw new Error("Antes debe Autenticarse");
    }

    if (!this.key) {
      throw new Error("Antes debe autenticarse");
    }

    const zip = new JSZip();

    let rLoteDEXml = `<rLoteDE>\n`;
    for (let i = 0; i < xmls.length; i++) {
      const xml = xmls[i].split("\n").slice(1).join("\n"); //Retirar xml
      rLoteDEXml += `${xml}\n`;
    }
    rLoteDEXml += `</rLoteDE>`;
    rLoteDEXml = this.normalizeXML(rLoteDEXml);

    zip.file(
      `xml_file.xml`,
      `<?xml version="1.0" encoding="UTF-8"?>${rLoteDEXml}`
    );

    const zipAsBase64 = await zip.generateAsync({ type: "base64" });

    const httpsAgent = new https.Agent({
      cert: Buffer.from(this.cert, "utf8"),
      key: Buffer.from(this.key, "utf8"),
    });

    let soapXMLData = `<?xml version="1.0" encoding="UTF-8"?>\n\
                        <env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope">\n\
                            <env:Header/>\n\
                            <env:Body>\n\
                                <rEnvioLote xmlns="http://ekuatia.set.gov.py/sifen/xsd">\n\
                                    <dId>${id}</dId>\n\
                                    <xDE>${zipAsBase64}</xDE>\n\
                                </rEnvioLote>\n\
                            </env:Body>\n\
                        </env:Envelope>\n`;
    soapXMLData = this.normalizeXML(soapXMLData);

    if (defaultConfig.debug === true) {
      console.log("url", url, "soapXMLData", soapXMLData);
    }

    if (defaultConfig.saveRequestFile) {
      await fs.writeFile(defaultConfig.saveRequestFile, soapXMLData);
    }

    try {
      const respuestaSuccess = await axios.post(`${url}`, soapXMLData, {
        headers: {
          "User-Agent": "facturaSend",
          "Content-Type": "application/xml; charset=utf-8",
        },
        httpsAgent,
        timeout: defaultConfig.timeout,
      });

      var parser = new xml2js.Parser({ explicitArray: false });
      if (respuestaSuccess.status == 200) {
        if ((respuestaSuccess.data + "").startsWith("<?xml")) {
          const result = await parser.parseStringPromise(respuestaSuccess.data);
          const resultData = result["env:Envelope"]["env:Body"];
          resultData["id"] = id;
          delete resultData.$;
          return resultData;
        } else {
          if ((respuestaSuccess.data + "").startsWith("<html>")) {
            throw new Error("Error de la SET BIG-IP logout page");
          } else {
            throw new Error(respuestaSuccess.data + "");
          }
        }
      } else {
        throw new Error("Error de conexión con la SET");
      }
    } catch (err: any) {
      if (err && err.response && err.response.data) {
        var xmlResponse = err.response.data;
        var parser = new xml2js.Parser({ explicitArray: false });
        try {
          const result = await parser.parseStringPromise(xmlResponse);
          const resultData = result["env:Envelope"]["env:Body"];
          resultData["id"] = id;
          return resultData;
        } catch (error) {
          throw error;
        }
      } else {
        throw err;
      }
    }
  }

  async evento(
    id: number,
    xml: string,
    env: "test" | "prod",
    certificado: any,
    passphase: any,
    config?: SetApiConfig
  ): Promise<any> {
    let defaultConfig: SetApiConfig = {
      debug: false,
      timeout: 90000,
    };

    defaultConfig = Object.assign(defaultConfig, config);

    this.abrir(certificado, passphase);

    let url = "https://sifen.set.gov.py/de/ws/eventos/evento.wsdl";
    if (env == "test") {
      url = "https://sifen-test.set.gov.py/de/ws/eventos/evento.wsdl";
    }

    if (!this.cert) {
      throw new Error("Antes debe Autenticarse");
    }

    if (!this.key) {
      throw new Error("Antes debe autenticarse");
    }

    const httpsAgent = new https.Agent({
      cert: Buffer.from(this.cert, "utf8"),
      key: Buffer.from(this.key, "utf8"),
    });

    let soapXMLData = this.normalizeXML(xml); // xml ya con soap
    if (defaultConfig.debug === true) {
      console.log("soapXMLData", soapXMLData);
    }

    if (defaultConfig.saveRequestFile) {
      await fs.writeFile(defaultConfig.saveRequestFile, soapXMLData);
    }

    try {
      const respuestaSuccess = await axios.post(`${url}`, soapXMLData, {
        headers: {
          "User-Agent": "facturaSend",
          "Content-Type": "application/xml; charset=utf-8",
        },
        httpsAgent,
        timeout: defaultConfig.timeout,
      });

      var parser = new xml2js.Parser({ explicitArray: false });
      if (respuestaSuccess.status == 200) {
        if ((respuestaSuccess.data + "").startsWith("<?xml")) {
          const result = await parser.parseStringPromise(respuestaSuccess.data);
          const resultData = result["env:Envelope"]["env:Body"];
          resultData.id = id;
          return resultData;
        } else {
          if ((respuestaSuccess.data + "").startsWith("<html>")) {
            throw new Error("Error de la SET BIG-IP logout page");
          } else {
            throw new Error(respuestaSuccess.data + "");
          }
        }
      } else {
        throw new Error("Error de conexión con la SET");
      }
    } catch (err: any) {
      if (err && err.response && err.response.data) {
        var xmlResponse = err.response.data;
        var parser = new xml2js.Parser({ explicitArray: false });
        try {
          const result = await parser.parseStringPromise(xmlResponse);
          const resultData = result["env:Envelope"]["env:Body"];
          resultData.id = id;
          return resultData;
        } catch (error) {
          throw error;
        }
      } else {
        throw err;
      }
    }
  }

  private normalizeXML(xml: string) {
    xml = xml.split("\r\n").join("");
    xml = xml.split("\n").join("");
    xml = xml.split("\t").join("");
    xml = xml.split("    ").join("");
    xml = xml.split(">    <").join("><");
    xml = xml.split(">  <").join("><");
    xml = xml.replace(/\r?\n|\r/g, "");
    return xml;
  }
}

export default new SET();
