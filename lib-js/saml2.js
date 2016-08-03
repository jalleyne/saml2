// Generated by CoffeeScript 1.7.1
var IdentityProvider, SAMLError, ServiceProvider, XMLNS, _, add_namespaces_to_child_assertions, async, certificate_to_keyinfo, check_saml_signature, check_status_success, create_authn_request, create_logout_request, create_logout_response, create_metadata, crypto, debug, decrypt_assertion, extract_certificate_data, format_pem, get_name_id, get_session_index, get_signed_data, get_status, parseString, parse_assertion_attributes, parse_authn_response, parse_logout_request, parse_response_header, pretty_assertion_attributes, set_option_defaults, sign_request, to_error, url, util, xmlbuilder, xmlcrypto, xmldom, xmlenc, zlib,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  slice = [].slice,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

_ = require('underscore');

async = require('async');

crypto = require('crypto');

debug = require('debug')('saml2');

parseString = require('xml2js').parseString;

url = require('url');

util = require('util');

xmlbuilder = require('xmlbuilder');

xmlcrypto = require('xml-crypto');

xmldom = require('xmldom');

xmlenc = require('xml-encryption');

zlib = require('zlib');

XMLNS = {
  SAML: 'urn:oasis:names:tc:SAML:2.0:assertion',
  SAMLP: 'urn:oasis:names:tc:SAML:2.0:protocol',
  MD: 'urn:oasis:names:tc:SAML:2.0:metadata',
  DS: 'http://www.w3.org/2000/09/xmldsig#',
  XENC: 'http://www.w3.org/2001/04/xmlenc#',
  EXC_C14N: 'http://www.w3.org/2001/10/xml-exc-c14n#'
};

SAMLError = (function(superClass) {
  extend(SAMLError, superClass);

  function SAMLError(message, extra) {
    this.message = message;
    this.extra = extra;
    SAMLError.__super__.constructor.call(this, this.message);
  }

  return SAMLError;

})(Error);

create_authn_request = function(issuer, assert_endpoint, destination, force_authn, context, nameid_format) {
  var context_element, id, xml;
  if (context != null) {
    context_element = _(context.class_refs).map(function(class_ref) {
      return {
        'saml:AuthnContextClassRef': class_ref
      };
    });
    context_element.push({
      '@Comparison': context.comparison
    });
  }
  id = '_' + crypto.randomBytes(21).toString('hex');
  xml = xmlbuilder.create({
    AuthnRequest: {
      '@xmlns': XMLNS.SAMLP,
      '@xmlns:saml': XMLNS.SAML,
      '@Version': '2.0',
      '@ID': id,
      '@IssueInstant': (new Date()).toISOString(),
      '@Destination': destination,
      '@AssertionConsumerServiceURL': assert_endpoint,
      '@ProtocolBinding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
      '@ForceAuthn': force_authn,
      'saml:Issuer': issuer,
      NameIDPolicy: {
        '@Format': nameid_format || 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified',
        '@AllowCreate': 'true'
      },
      RequestedAuthnContext: context_element
    }
  }).end();
  return {
    id: id,
    xml: xml
  };
};

create_metadata = function(entity_id, assert_endpoint, signing_certificates, encryption_certificates) {
  var encryption_cert_descriptors, encryption_certificate, signing_cert_descriptors, signing_certificate;
  signing_cert_descriptors = (function() {
    var i, len, ref1, results;
    ref1 = signing_certificates || [];
    results = [];
    for (i = 0, len = ref1.length; i < len; i++) {
      signing_certificate = ref1[i];
      results.push({
        'md:KeyDescriptor': certificate_to_keyinfo('signing', signing_certificate)
      });
    }
    return results;
  })();
  encryption_cert_descriptors = (function() {
    var i, len, ref1, results;
    ref1 = encryption_certificates || [];
    results = [];
    for (i = 0, len = ref1.length; i < len; i++) {
      encryption_certificate = ref1[i];
      results.push({
        'md:KeyDescriptor': certificate_to_keyinfo('encryption', encryption_certificate)
      });
    }
    return results;
  })();
  return xmlbuilder.create({
    'md:EntityDescriptor': {
      '@xmlns:md': XMLNS.MD,
      '@xmlns:ds': XMLNS.DS,
      '@entityID': entity_id,
      '@validUntil': (new Date(Date.now() + 1000 * 60 * 60)).toISOString(),
      'md:SPSSODescriptor': [].concat({
        '@protocolSupportEnumeration': 'urn:oasis:names:tc:SAML:1.1:protocol urn:oasis:names:tc:SAML:2.0:protocol'
      }).concat(signing_cert_descriptors).concat(encryption_cert_descriptors).concat([
        {
          'md:SingleLogoutService': {
            '@Binding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
            '@Location': assert_endpoint
          },
          'md:AssertionConsumerService': {
            '@Binding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
            '@Location': assert_endpoint,
            '@index': '0'
          }
        }
      ])
    }
  }).end();
};

create_logout_request = function(issuer, name_id, session_index, destination) {
  var id, xml;
  id = '_' + crypto.randomBytes(21).toString('hex');
  xml = xmlbuilder.create({
    'samlp:LogoutRequest': {
      '@xmlns:samlp': XMLNS.SAMLP,
      '@xmlns:saml': XMLNS.SAML,
      '@ID': id,
      '@Version': '2.0',
      '@IssueInstant': (new Date()).toISOString(),
      '@Destination': destination,
      'saml:Issuer': issuer,
      'saml:NameID': name_id,
      'samlp:SessionIndex': session_index
    }
  }).end();
  return {
    id: id,
    xml: xml
  };
};

create_logout_response = function(issuer, in_response_to, destination, status) {
  if (status == null) {
    status = 'urn:oasis:names:tc:SAML:2.0:status:Success';
  }
  return xmlbuilder.create({
    'samlp:LogoutResponse': {
      '@Destination': destination,
      '@ID': '_' + crypto.randomBytes(21).toString('hex'),
      '@InResponseTo': in_response_to,
      '@IssueInstant': (new Date()).toISOString(),
      '@Version': '2.0',
      '@xmlns:samlp': XMLNS.SAMLP,
      '@xmlns:saml': XMLNS.SAML,
      'saml:Issuer': issuer,
      'samlp:Status': {
        'samlp:StatusCode': {
          '@Value': status
        }
      }
    }
  }, {
    headless: true
  }).end();
};

format_pem = function(key, type) {
  if ((/-----BEGIN [0-9A-Z ]+-----[^-]*-----END [0-9A-Z ]+-----/g.exec(key)) != null) {
    return key;
  }
  return ("-----BEGIN " + (type.toUpperCase()) + "-----\n") + key.match(/.{1,64}/g).join("\n") + ("\n-----END " + (type.toUpperCase()) + "-----");
};

sign_request = function(saml_request, private_key, relay_state, response) {
  var action, data, relay_state_data, samlQueryString, saml_request_data, sigalg_data, sign;
  if (response == null) {
    response = false;
  }
  action = response ? "SAMLResponse" : "SAMLRequest";
  data = (action + "=") + encodeURIComponent(saml_request);
  if (relay_state) {
    data += "&RelayState=" + encodeURIComponent(relay_state);
  }
  data += "&SigAlg=" + encodeURIComponent('http://www.w3.org/2001/04/xmldsig-more#rsa-sha256');
  saml_request_data = (action + "=") + encodeURIComponent(saml_request);
  relay_state_data = relay_state != null ? "&RelayState=" + encodeURIComponent(relay_state) : "";
  sigalg_data = "&SigAlg=" + encodeURIComponent('http://www.w3.org/2001/04/xmldsig-more#rsa-sha256');
  sign = crypto.createSign('RSA-SHA256');
  sign.update(saml_request_data + relay_state_data + sigalg_data);
  samlQueryString = {};
  if (response) {
    samlQueryString.SAMLResponse = saml_request;
  } else {
    samlQueryString.SAMLRequest = saml_request;
  }
  if (relay_state) {
    samlQueryString.RelayState = relay_state;
  }
  samlQueryString.SigAlg = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
  samlQueryString.Signature = sign.sign(format_pem(private_key, 'PRIVATE KEY'), 'base64');
  return samlQueryString;
};

certificate_to_keyinfo = function(use, certificate) {
  return {
    '@use': use,
    'ds:KeyInfo': {
      '@xmlns:ds': XMLNS.DS,
      'ds:X509Data': {
        'ds:X509Certificate': extract_certificate_data(certificate)
      }
    }
  };
};

extract_certificate_data = function(certificate) {
  var cert_data;
  cert_data = /-----BEGIN CERTIFICATE-----([^-]*)-----END CERTIFICATE-----/g.exec(certificate);
  cert_data = cert_data != null ? cert_data[1] : certificate;
  if (cert_data == null) {
    throw new Error('Invalid Certificate');
  }
  return cert_data.replace(/[\r\n]/g, '');
};

check_saml_signature = function(xml, certificate) {
  var doc, sig, signature, valid;
  doc = (new xmldom.DOMParser()).parseFromString(xml);
  signature = xmlcrypto.xpath(doc, ".//*[local-name(.)='Signature' and namespace-uri(.)='http://www.w3.org/2000/09/xmldsig#']");
  if (signature.length !== 1) {
    return null;
  }
  sig = new xmlcrypto.SignedXml();
  sig.keyInfoProvider = {
    getKey: function() {
      return format_pem(certificate, 'CERTIFICATE');
    }
  };
  sig.loadSignature(signature[0].toString());
  valid = sig.checkSignature(xml);
  if (valid) {
    return get_signed_data(doc, sig.references);
  } else {
    return null;
  }
};

get_signed_data = function(doc, references) {
  return _.map(references, function(ref) {
    var elem, i, idAttribute, len, ref1, uri;
    uri = ref.uri;
    if (uri[0] === '#') {
      uri = uri.substring(1);
    }
    elem = [];
    if (uri === "") {
      elem = xmlcrypto.xpath(doc, "//*");
    } else {
      ref1 = ["Id", "ID"];
      for (i = 0, len = ref1.length; i < len; i++) {
        idAttribute = ref1[i];
        elem = xmlcrypto.xpath(doc, "//*[@*[local-name(.)='" + idAttribute + "']='" + uri + "']");
        if (elem.length > 0) {
          break;
        }
      }
    }
    if (!(elem.length > 0)) {
      throw new Error("Invalid signature; must be a reference to '" + ref.uri + "'");
    }
    return elem[0].toString();
  });
};

check_status_success = function(dom) {
  var attr, i, j, len, len1, ref1, ref2, status, status_code;
  status = dom.getElementsByTagNameNS(XMLNS.SAMLP, 'Status');
  if (status.length !== 1) {
    return false;
  }
  ref1 = status[0].childNodes || [];
  for (i = 0, len = ref1.length; i < len; i++) {
    status_code = ref1[i];
    if (status_code.attributes != null) {
      ref2 = status_code.attributes || [];
      for (j = 0, len1 = ref2.length; j < len1; j++) {
        attr = ref2[j];
        if ((attr != null ? attr.name : void 0) === 'Value' && (attr != null ? attr.value : void 0) === 'urn:oasis:names:tc:SAML:2.0:status:Success') {
          return true;
        }
      }
    }
  }
  return false;
};

get_status = function(dom) {
  var attr, i, j, l, len, len1, len2, len3, m, ref1, ref2, ref3, ref4, status, status_code, status_list, sub_status_code, top_status;
  status_list = {};
  status = dom.getElementsByTagNameNS(XMLNS.SAMLP, 'Status');
  if (status.length !== 1) {
    return status_list;
  }
  ref1 = status[0].childNodes || [];
  for (i = 0, len = ref1.length; i < len; i++) {
    status_code = ref1[i];
    if (status_code.attributes != null) {
      ref2 = (status_code != null ? status_code.attributes : void 0) || [];
      for (j = 0, len1 = ref2.length; j < len1; j++) {
        attr = ref2[j];
        if ((attr != null ? attr.name : void 0) === 'Value') {
          top_status = attr.value;
          if (status_list[top_status] == null) {
            status_list[top_status] = [];
          }
        }
      }
    }
    ref3 = status_code.childNodes || [];
    for (l = 0, len2 = ref3.length; l < len2; l++) {
      sub_status_code = ref3[l];
      if ((sub_status_code != null ? sub_status_code.attributes : void 0) != null) {
        ref4 = sub_status_code.attributes || [];
        for (m = 0, len3 = ref4.length; m < len3; m++) {
          attr = ref4[m];
          if ((attr != null ? attr.name : void 0) === 'Value') {
            status_list[top_status].push(attr != null ? attr.value : void 0);
          }
        }
      }
    }
  }
  return status_list;
};

to_error = function(err) {
  if (err == null) {
    return null;
  }
  if (!(err instanceof Error)) {
    return new Error(util.inspect(err));
  }
  return err;
};

decrypt_assertion = function(dom, private_keys, cb) {
  var encrypted_assertion, encrypted_data, err, error, errors;
  cb = _.wrap(cb, function() {
    var args, err, fn;
    fn = arguments[0], err = arguments[1], args = 3 <= arguments.length ? slice.call(arguments, 2) : [];
    return setTimeout((function() {
      return fn.apply(null, [to_error(err)].concat(slice.call(args)));
    }), 0);
  });
  try {
    encrypted_assertion = dom.getElementsByTagNameNS(XMLNS.SAML, 'EncryptedAssertion');
    if (encrypted_assertion.length !== 1) {
      return cb(new Error("Expected 1 EncryptedAssertion; found " + encrypted_assertion.length + "."));
    }
    encrypted_data = encrypted_assertion[0].getElementsByTagNameNS(XMLNS.XENC, 'EncryptedData');
    if (encrypted_data.length !== 1) {
      return cb(new Error("Expected 1 EncryptedData inside EncryptedAssertion; found " + encrypted_data.length + "."));
    }
    encrypted_data = encrypted_data[0].toString();
    errors = [];
    return async.eachOfSeries(private_keys, function(private_key, index, cb_e) {
      return xmlenc.decrypt(encrypted_data, {
        key: format_pem(private_key, 'PRIVATE KEY')
      }, function(err, result) {
        if (err != null) {
          if (err != null) {
            errors.push(new Error("Decrypt failed: " + (util.inspect(err))));
          }
          return cb_e();
        }
        debug("Decryption successful with private key #" + index + ".");
        return cb(null, result);
      });
    }, function() {
      return cb(new Error("Failed to decrypt assertion with provided key(s): " + (util.inspect(errors))));
    });
  } catch (error) {
    err = error;
    return cb(new Error("Decrypt failed: " + (util.inspect(err))));
  }
};

parse_response_header = function(dom) {
  var attr, i, j, len, len1, ref1, ref2, response, response_header, response_type;
  ref1 = ['Response', 'LogoutResponse', 'LogoutRequest'];
  for (i = 0, len = ref1.length; i < len; i++) {
    response_type = ref1[i];
    response = dom.getElementsByTagNameNS(XMLNS.SAMLP, response_type);
    if (response.length > 0) {
      break;
    }
  }
  if (response.length !== 1) {
    throw new Error("Expected 1 Response; found " + response.length);
  }
  response_header = {};
  ref2 = response[0].attributes || [];
  for (j = 0, len1 = ref2.length; j < len1; j++) {
    attr = ref2[j];
    switch (attr != null ? attr.name : void 0) {
      case "Version":
        if (attr.value !== "2.0") {
          throw new Error("Invalid SAML Version " + attr.value);
        }
        break;
      case "Destination":
        response_header.destination = attr.value;
        break;
      case "InResponseTo":
        response_header.in_response_to = attr.value;
        break;
      case "ID":
        response_header.id = attr.value;
    }
  }
  return response_header;
};

get_name_id = function(dom) {
  var assertion, nameid, ref1, subject;
  assertion = dom.getElementsByTagNameNS(XMLNS.SAML, 'Assertion');
  if (assertion.length !== 1) {
    throw new Error("Expected 1 Assertion; found " + assertion.length);
  }
  subject = assertion[0].getElementsByTagNameNS(XMLNS.SAML, 'Subject');
  if (subject.length !== 1) {
    throw new Error("Expected 1 Subject; found " + subject.length);
  }
  nameid = subject[0].getElementsByTagNameNS(XMLNS.SAML, 'NameID');
  if (nameid.length !== 1) {
    return null;
  }
  return (ref1 = nameid[0].firstChild) != null ? ref1.data : void 0;
};

get_session_index = function(dom, index_required) {
  var assertion, attr, authn_statement, i, len, ref1;
  if (index_required == null) {
    index_required = true;
  }
  assertion = dom.getElementsByTagNameNS(XMLNS.SAML, 'Assertion');
  if (assertion.length !== 1) {
    throw new Error("Expected 1 Assertion; found " + assertion.length);
  }
  authn_statement = assertion[0].getElementsByTagNameNS(XMLNS.SAML, 'AuthnStatement');
  if (authn_statement.length !== 1) {
    throw new Error("Expected 1 AuthnStatement; found " + authn_statement.length);
  }
  ref1 = authn_statement[0].attributes || [];
  for (i = 0, len = ref1.length; i < len; i++) {
    attr = ref1[i];
    if ((attr != null ? attr.name : void 0) === 'SessionIndex') {
      return attr.value;
    }
  }
  if (index_required) {
    throw new Error("SessionIndex not an attribute of AuthnStatement.");
  } else {
    return null;
  }
};

parse_assertion_attributes = function(dom) {
  var assertion, assertion_attributes, attr, attribute, attribute_name, attribute_statement, attribute_values, i, j, len, len1, ref1, ref2;
  assertion = dom.getElementsByTagNameNS(XMLNS.SAML, 'Assertion');
  if (assertion.length !== 1) {
    throw new Error("Expected 1 Assertion; found " + assertion.length);
  }
  attribute_statement = assertion[0].getElementsByTagNameNS(XMLNS.SAML, 'AttributeStatement');
  if (!(attribute_statement.length <= 1)) {
    throw new Error("Expected 1 AttributeStatement inside Assertion; found " + attribute_statement.length);
  }
  if (attribute_statement.length === 0) {
    return {};
  }
  assertion_attributes = {};
  ref1 = attribute_statement[0].getElementsByTagNameNS(XMLNS.SAML, 'Attribute');
  for (i = 0, len = ref1.length; i < len; i++) {
    attribute = ref1[i];
    ref2 = (attribute != null ? attribute.attributes : void 0) || [];
    for (j = 0, len1 = ref2.length; j < len1; j++) {
      attr = ref2[j];
      if ((attr != null ? attr.name : void 0) === 'Name') {
        attribute_name = attr != null ? attr.value : void 0;
      }
    }
    if (attribute_name == null) {
      throw new Error("Invalid attribute without name");
    }
    attribute_values = attribute.getElementsByTagNameNS(XMLNS.SAML, 'AttributeValue');
    assertion_attributes[attribute_name] = _(attribute_values).map(function(attribute_value) {
      var ref3;
      return ((ref3 = attribute_value.childNodes[0]) != null ? ref3.data : void 0) || '';
    });
  }
  return assertion_attributes;
};

pretty_assertion_attributes = function(assertion_attributes) {
  var claim_map;
  claim_map = {
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress": "email",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname": "given_name",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name": "name",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn": "upn",
    "http://schemas.xmlsoap.org/claims/CommonName": "common_name",
    "http://schemas.xmlsoap.org/claims/Group": "group",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": "role",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname": "surname",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/privatepersonalidentifier": "ppid",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": "name_id",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/authenticationmethod": "authentication_method",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/denyonlysid": "deny_only_group_sid",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/denyonlyprimarysid": "deny_only_primary_sid",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/denyonlyprimarygroupsid": "deny_only_primary_group_sid",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/groupsid": "group_sid",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/primarygroupsid": "primary_group_sid",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/primarysid": "primary_sid",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/windowsaccountname": "windows_account_name"
  };
  return _(assertion_attributes).chain().pairs().filter(function(arg) {
    var k, v;
    k = arg[0], v = arg[1];
    return (claim_map[k] != null) && v.length > 0;
  }).map(function(arg) {
    var k, v;
    k = arg[0], v = arg[1];
    return [claim_map[k], v[0]];
  }).object().value();
};

add_namespaces_to_child_assertions = function(xml_string) {
  var assertion_element, assertion_elements, doc, i, inclusive_namespaces, len, new_attribute, ns, prefix_list, ref1, response_element, response_elements;
  doc = new xmldom.DOMParser().parseFromString(xml_string);
  response_elements = doc.getElementsByTagNameNS(XMLNS.SAMLP, 'Response');
  if (response_elements.length !== 1) {
    return xml_string;
  }
  response_element = response_elements[0];
  assertion_elements = response_element.getElementsByTagNameNS(XMLNS.SAML, 'Assertion');
  if (assertion_elements.length !== 1) {
    return xml_string;
  }
  assertion_element = assertion_elements[0];
  if (assertion_element.getElementsByTagNameNS(XMLNS.DS, 'Signature').length === 0) {
    return xml_string;
  }
  inclusive_namespaces = assertion_element.getElementsByTagNameNS(XMLNS.EXC_C14N, 'InclusiveNamespaces')[0];
  if (!inclusive_namespaces) {
    return xml_string;
  }
  prefix_list = inclusive_namespaces.getAttribute('PrefixList');
  ref1 = prefix_list.split(' ');
  for (i = 0, len = ref1.length; i < len; i++) {
    ns = ref1[i];
    if (response_element.getAttribute('xmlns:' + ns) && !assertion_element.getAttribute('xmlns:' + ns)) {
      new_attribute = doc.createAttribute('xmlns:' + ns);
      new_attribute.value = response_element.getAttribute('xmlns:' + ns);
      assertion_element.setAttributeNode(new_attribute);
    }
  }
  return new xmldom.XMLSerializer().serializeToString(response_element);
};

parse_authn_response = function(saml_response, sp_private_keys, idp_certificates, allow_unencrypted, ignore_signature, require_session_index, cb) {
  var user;
  user = {};
  return async.waterfall([
    function(cb_wf) {
      return decrypt_assertion(saml_response, sp_private_keys, function(err, result) {
        var assertion;
        if (err == null) {
          return cb_wf(null, result);
        }
        if (!allow_unencrypted) {
          return cb_wf(err, result);
        }
        assertion = saml_response.getElementsByTagNameNS(XMLNS.SAML, 'Assertion');
        if (assertion.length !== 1) {
          return cb_wf(new Error("Expected 1 Assertion or 1 EncryptedAssertion; found " + assertion.length));
        }
        return cb_wf(null, assertion[0].toString());
      });
    }, function(result, cb_wf) {
      var assertion, cert, i, j, len, len1, ref1, saml_response_str, sd, signed_data, signed_dom;
      debug(result);
      if (ignore_signature) {
        return cb_wf(null, (new xmldom.DOMParser()).parseFromString(result));
      }
      saml_response_str = saml_response.toString();
      ref1 = idp_certificates || [];
      for (i = 0, len = ref1.length; i < len; i++) {
        cert = ref1[i];
        signed_data = check_saml_signature(result, cert) || check_saml_signature(saml_response_str, cert);
        if (!signed_data) {
          continue;
        }
        for (j = 0, len1 = signed_data.length; j < len1; j++) {
          sd = signed_data[j];
          signed_dom = (new xmldom.DOMParser()).parseFromString(sd);
          assertion = signed_dom.getElementsByTagNameNS(XMLNS.SAML, 'Assertion');
          if (assertion.length === 1) {
            return cb_wf(null, signed_dom);
          }
        }
        return cb_wf(new Error("Signed data did not contain a SAML Assertion!"));
      }
      return cb_wf(new Error("SAML Assertion signature check failed! (checked " + idp_certificates.length + " certificate(s))"));
    }, function(decrypted_assertion, cb_wf) {
      var assertion_attributes, err, error;
      try {
        user.name_id = get_name_id(decrypted_assertion);
        user.session_index = get_session_index(decrypted_assertion, require_session_index);
        assertion_attributes = parse_assertion_attributes(decrypted_assertion);
        user = _.extend(user, pretty_assertion_attributes(assertion_attributes));
        user = _.extend(user, {
          attributes: assertion_attributes
        });
        return cb_wf(null, {
          user: user
        });
      } catch (error) {
        err = error;
        return cb_wf(err);
      }
    }
  ], cb);
};

parse_logout_request = function(dom) {
  var issuer, name_id, ref1, ref2, ref3, request, session_index;
  request = dom.getElementsByTagNameNS(XMLNS.SAMLP, "LogoutRequest");
  if (request.length !== 1) {
    throw new Error("Expected 1 LogoutRequest; found " + request.length);
  }
  request = {};
  issuer = dom.getElementsByTagNameNS(XMLNS.SAML, 'Issuer');
  if (issuer.length === 1) {
    request.issuer = (ref1 = issuer[0].firstChild) != null ? ref1.data : void 0;
  }
  name_id = dom.getElementsByTagNameNS(XMLNS.SAML, 'NameID');
  if (name_id.length === 1) {
    request.name_id = (ref2 = name_id[0].firstChild) != null ? ref2.data : void 0;
  }
  session_index = dom.getElementsByTagNameNS(XMLNS.SAMLP, 'SessionIndex');
  if (session_index.length === 1) {
    request.session_index = (ref3 = session_index[0].firstChild) != null ? ref3.data : void 0;
  }
  return request;
};

set_option_defaults = function(request_options, idp_options, sp_options) {
  return _.defaults({}, request_options, idp_options, sp_options);
};

module.exports.ServiceProvider = ServiceProvider = (function() {
  function ServiceProvider(options) {
    this.create_metadata = bind(this.create_metadata, this);
    this.create_logout_request_url = bind(this.create_logout_request_url, this);
    this.entity_id = options.entity_id, this.private_key = options.private_key, this.certificate = options.certificate, this.assert_endpoint = options.assert_endpoint, this.alt_private_keys = options.alt_private_keys, this.alt_certs = options.alt_certs, this.require_session_index = options.require_session_index;
    this.alt_private_keys = [].concat(this.alt_private_keys || []);
    this.alt_certs = [].concat(this.alt_certs || []);
    this.shared_options = _(options).pick("force_authn", "auth_context", "nameid_format", "sign_get_request", "allow_unencrypted_assertion", "require_session_index");
  }

  ServiceProvider.prototype.create_login_request_url = function(identity_provider, options, cb) {
    var id, ref1, xml;
    options = set_option_defaults(options, identity_provider.shared_options, this.shared_options);
    ref1 = create_authn_request(this.entity_id, this.assert_endpoint, identity_provider.sso_login_url, options.force_authn, options.auth_context, options.nameid_format), id = ref1.id, xml = ref1.xml;
    return zlib.deflateRaw(xml, (function(_this) {
      return function(err, deflated) {
        var uri;
        if (err != null) {
          return cb(err);
        }
        uri = url.parse(identity_provider.sso_login_url);
        delete uri.search;
        if (options.sign_get_request) {
          uri.query = sign_request(deflated.toString('base64'), _this.private_key, options.relay_state);
        } else {
          uri.query = {
            SAMLRequest: deflated.toString('base64')
          };
          if (options.relay_state != null) {
            uri.query.RelayState = options.relay_state;
          }
        }
        return cb(null, url.format(uri), id);
      };
    })(this));
  };

  ServiceProvider.prototype.redirect_assert = function(identity_provider, options, cb) {
    options = _.extend(options, {
      get_request: true
    });
    options = set_option_defaults(options, identity_provider.shared_options, this.shared_options);
    return this._assert(identity_provider, options, cb);
  };

  ServiceProvider.prototype.post_assert = function(identity_provider, options, cb) {
    options = _.extend(options, {
      get_request: false
    });
    options = set_option_defaults(options, identity_provider.shared_options, this.shared_options);
    return this._assert(identity_provider, options, cb);
  };

  ServiceProvider.prototype._assert = function(identity_provider, options, cb) {
    var decrypted_assertion, ref1, ref2, response, saml_response;
    if (!((((ref1 = options.request_body) != null ? ref1.SAMLResponse : void 0) != null) || (((ref2 = options.request_body) != null ? ref2.SAMLRequest : void 0) != null))) {
      return setImmediate(cb, new Error("Request body does not contain SAMLResponse or SAMLRequest."));
    }
    saml_response = null;
    decrypted_assertion = null;
    response = {};
    return async.waterfall([
      function(cb_wf) {
        var raw;
        raw = new Buffer(options.request_body.SAMLResponse || options.request_body.SAMLRequest, 'base64');
        if (options.get_request) {
          return zlib.inflateRaw(raw, cb_wf);
        }
        return setImmediate(cb_wf, null, raw);
      }, (function(_this) {
        return function(response_buffer, cb_wf) {
          var err, error, saml_response_abnormalized;
          debug(saml_response);
          saml_response_abnormalized = add_namespaces_to_child_assertions(response_buffer.toString());
          saml_response = (new xmldom.DOMParser()).parseFromString(saml_response_abnormalized);
          try {
            response = {
              response_header: parse_response_header(saml_response)
            };
          } catch (error) {
            err = error;
            return cb(err);
          }
          switch (false) {
            case saml_response.getElementsByTagNameNS(XMLNS.SAMLP, 'Response').length !== 1:
              if (!check_status_success(saml_response)) {
                cb_wf(new SAMLError("SAML Response was not success!", {
                  status: get_status(saml_response)
                }));
              }
              response.type = 'authn_response';
              return parse_authn_response(saml_response, [_this.private_key].concat(_this.alt_private_keys), identity_provider.certificates, options.allow_unencrypted_assertion, options.ignore_signature, options.require_session_index, cb_wf);
            case saml_response.getElementsByTagNameNS(XMLNS.SAMLP, 'LogoutResponse').length !== 1:
              if (!check_status_success(saml_response)) {
                cb_wf(new SAMLError("SAML Response was not success!", {
                  status: get_status(saml_response)
                }));
              }
              response.type = 'logout_response';
              return setImmediate(cb_wf, null, {});
            case saml_response.getElementsByTagNameNS(XMLNS.SAMLP, 'LogoutRequest').length !== 1:
              response.type = 'logout_request';
              return setImmediate(cb_wf, null, parse_logout_request(saml_response));
          }
        };
      })(this), function(result, cb_wf) {
        _.extend(response, result);
        return cb_wf(null, response);
      }
    ], cb);
  };

  ServiceProvider.prototype.create_logout_request_url = function(identity_provider, options, cb) {
    var id, ref1, xml;
    if (_.isString(identity_provider)) {
      identity_provider = {
        sso_logout_url: identity_provider,
        options: {}
      };
    }
    options = set_option_defaults(options, identity_provider.shared_options, this.shared_options);
    ref1 = create_logout_request(this.entity_id, options.name_id, options.session_index, identity_provider.sso_logout_url), id = ref1.id, xml = ref1.xml;
    return zlib.deflateRaw(xml, (function(_this) {
      return function(err, deflated) {
        var query, uri;
        if (err != null) {
          return cb(err);
        }
        uri = url.parse(identity_provider.sso_logout_url, true);
        query = null;
        if (options.sign_get_request) {
          query = sign_request(deflated.toString('base64'), _this.private_key, options.relay_state);
        } else {
          query = {
            SAMLRequest: deflated.toString('base64')
          };
          if (options.relay_state != null) {
            query.RelayState = options.relay_state;
          }
        }
        uri.query = _.extend(query, uri.query);
        uri.search = null;
        uri.query = query;
        return cb(null, url.format(uri), id);
      };
    })(this));
  };

  ServiceProvider.prototype.create_logout_response_url = function(identity_provider, options, cb) {
    var xml;
    if (_.isString(identity_provider)) {
      identity_provider = {
        sso_logout_url: identity_provider,
        options: {}
      };
    }
    options = set_option_defaults(options, identity_provider.shared_options, this.shared_options);
    xml = create_logout_response(this.entity_id, options.in_response_to, identity_provider.sso_logout_url);
    return zlib.deflateRaw(xml, (function(_this) {
      return function(err, deflated) {
        var uri;
        if (err != null) {
          return cb(err);
        }
        uri = url.parse(identity_provider.sso_logout_url);
        if (options.sign_get_request) {
          uri.query = sign_request(deflated.toString('base64'), _this.private_key, options.relay_state, true);
        } else {
          uri.query = {
            SAMLResponse: deflated.toString('base64')
          };
          if (options.relay_state != null) {
            uri.query.RelayState = options.relay_state;
          }
        }
        return cb(null, url.format(uri));
      };
    })(this));
  };

  ServiceProvider.prototype.create_metadata = function() {
    var certs;
    certs = [this.certificate].concat(this.alt_certs);
    return create_metadata(this.entity_id, this.assert_endpoint, certs, certs);
  };

  return ServiceProvider;

})();

module.exports.IdentityProvider = IdentityProvider = (function() {
  function IdentityProvider(options) {
    this.sso_login_url = options.sso_login_url, this.sso_logout_url = options.sso_logout_url, this.certificates = options.certificates;
    if (!_.isArray(this.certificates)) {
      this.certificates = [this.certificates];
    }
    this.shared_options = _.pick(options, "force_authn", "sign_get_request", "allow_unencrypted_assertion");
  }

  return IdentityProvider;

})();

if (process.env.NODE_ENV === "test") {
  module.exports.create_authn_request = create_authn_request;
  module.exports.create_metadata = create_metadata;
  module.exports.format_pem = format_pem;
  module.exports.sign_request = sign_request;
  module.exports.check_saml_signature = check_saml_signature;
  module.exports.check_status_success = check_status_success;
  module.exports.pretty_assertion_attributes = pretty_assertion_attributes;
  module.exports.decrypt_assertion = decrypt_assertion;
  module.exports.parse_response_header = parse_response_header;
  module.exports.parse_logout_request = parse_logout_request;
  module.exports.get_name_id = get_name_id;
  module.exports.get_session_index = get_session_index;
  module.exports.parse_assertion_attributes = parse_assertion_attributes;
  module.exports.set_option_defaults = set_option_defaults;
  module.exports.extract_certificate_data = extract_certificate_data;
}
