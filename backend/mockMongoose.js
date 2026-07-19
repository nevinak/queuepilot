const { EventEmitter } = require('events');

// Global mock database
const db = {};

function createObjectId() {
  const hex = '0123456789abcdef';
  let str = '';
  for (let i = 0; i < 24; i++) {
    str += hex[Math.floor(Math.random() * 16)];
  }
  return {
    str,
    toString() { return str; },
    toJSON() { return str; },
    equals(other) { return this.str === (other ? other.toString() : ''); }
  };
}

class Schema {
  constructor(definition, options) {
    this.definition = definition;
    this.options = options;
    this.hooks = { pre: {} };
    this.methods = {};
  }
  
  pre(hookName, fn) {
    if (!this.hooks.pre[hookName]) {
      this.hooks.pre[hookName] = [];
    }
    this.hooks.pre[hookName].push(fn);
  }
  
  index() {}
}

Schema.Types = {
  ObjectId: 'ObjectId'
};

const relations = {
  departmentId: 'Department',
  doctorId: 'Doctor',
  patientId: 'Patient',
  doctors: 'Doctor',
  queueHistory: 'Queue',
  notifications: 'Notification'
};

class Query {
  constructor(modelName, filterFn) {
    this.modelName = modelName;
    this.filterFn = filterFn;
    this.populatePaths = [];
    this.skipVal = 0;
    this.limitVal = null;
    this.sortVal = null;
    this.leanVal = false;
    this.selectVal = null;
  }
  
  populate(paths) {
    if (typeof paths === 'string') {
      this.populatePaths.push(...paths.split(/\s+/));
    }
    return this;
  }
  
  skip(val) {
    this.skipVal = val;
    return this;
  }
  
  limit(val) {
    this.limitVal = val;
    return this;
  }
  
  sort(val) {
    this.sortVal = val;
    return this;
  }
  
  lean() {
    this.leanVal = true;
    return this;
  }
  
  select(val) {
    this.selectVal = val;
    return this;
  }
  
  async execute() {
    const list = db[this.modelName] || [];
    let results = list.filter(this.filterFn);
    
    // Sort
    if (this.sortVal) {
      const keys = Object.keys(this.sortVal);
      results.sort((a, b) => {
        for (const key of keys) {
          const dir = this.sortVal[key];
          const valA = a[key];
          const valB = b[key];
          if (valA < valB) return -1 * dir;
          if (valA > valB) return 1 * dir;
        }
        return 0;
      });
    }
    
    // Skip
    if (this.skipVal) {
      results = results.slice(this.skipVal);
    }
    
    // Limit
    if (this.limitVal !== null) {
      results = results.slice(0, this.limitVal);
    }
    
    // Deep copy/clone to mimic DB
    results = results.map(doc => {
      const copy = { ...doc };
      if (!this.leanVal) {
        Object.setPrototypeOf(copy, Object.getPrototypeOf(doc));
      }
      return copy;
    });
    
    // Populate
    for (const path of this.populatePaths) {
      const targetModel = relations[path];
      if (targetModel) {
        for (const doc of results) {
          const refVal = doc[path];
          if (Array.isArray(refVal)) {
            doc[path] = refVal.map(id => {
              const targetList = db[targetModel] || [];
              return targetList.find(item => item._id.toString() === id.toString()) || id;
            });
          } else if (refVal) {
            const targetList = db[targetModel] || [];
            doc[path] = targetList.find(item => item._id.toString() === refVal.toString()) || refVal;
          }
        }
      }
    }
    
    // Select (e.g. -password)
    if (this.selectVal) {
      let fields = [];
      let isExclude = false;
      if (typeof this.selectVal === 'string') {
        fields = this.selectVal.split(/\s+/);
        isExclude = fields.every(f => f.startsWith('-'));
        if (isExclude) fields = fields.map(f => f.slice(1));
      }
      results = results.map(doc => {
        const copy = { ...doc };
        if (isExclude) {
          for (const f of fields) delete copy[f];
        } else {
          const newDoc = { _id: copy._id };
          for (const f of fields) newDoc[f] = copy[f];
          return newDoc;
        }
        return copy;
      });
    }
    
    // Post-process to ensure all returned docs have 'id' and correct fields
    for (const doc of results) {
      if (doc._id) {
        doc.id = doc._id.toString();
      }
      if (this.modelName === 'Doctor' && doc.departmentId) {
        doc.department = doc.departmentId._id ? doc.departmentId._id.toString() : doc.departmentId.toString();
      }
    }

    return results;
  }
  
  then(resolve, reject) {
    this.execute().then(resolve, reject);
  }
}

class SingleQuery extends Query {
  async execute() {
    const results = await super.execute();
    return results[0] || null;
  }
}

class CountQuery extends Query {
  async execute() {
    const list = db[this.modelName] || [];
    return list.filter(this.filterFn).length;
  }
}

function matchQuery(doc, query) {
  if (!query) return true;
  for (const key of Object.keys(query)) {
    const val = query[key];
    if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      for (const op of Object.keys(val)) {
        const opVal = val[op];
        const docVal = doc[key];
        if (op === '$gte') {
          if (!(docVal >= opVal)) return false;
        } else if (op === '$gt') {
          if (!(docVal > opVal)) return false;
        } else if (op === '$lte') {
          if (!(docVal <= opVal)) return false;
        } else if (op === '$lt') {
          if (!(docVal < opVal)) return false;
        } else if (op === '$in') {
          const list = Array.isArray(opVal) ? opVal.map(x => x.toString()) : [];
          if (!list.includes(docVal ? docVal.toString() : '')) return false;
        } else if (op === '$nin') {
          const list = Array.isArray(opVal) ? opVal.map(x => x.toString()) : [];
          if (list.includes(docVal ? docVal.toString() : '')) return false;
        }
      }
    } else {
      const docVal = doc[key] ? doc[key].toString() : doc[key];
      const queryVal = val ? val.toString() : val;
      if (docVal !== queryVal) return false;
    }
  }
  return true;
}

function model(modelName, schema) {
  if (!db[modelName]) {
    db[modelName] = [];
  }
  
  class Model {
    constructor(data) {
      Object.assign(this, data);
      if (!this._id) {
        this._id = createObjectId();
      }
      this.id = this._id.toString();
      if (modelName === 'Doctor' && this.departmentId) {
        this.department = this.departmentId._id ? this.departmentId._id.toString() : this.departmentId.toString();
      }
      this.createdAt = this.createdAt || new Date();
      this.updatedAt = this.updatedAt || new Date();
      
      // Initialize fields based on schema definition (including defaults and arrays)
      if (schema && schema.definition) {
        for (const key of Object.keys(schema.definition)) {
          const fieldDef = schema.definition[key];
          if (Array.isArray(fieldDef)) {
            this[key] = this[key] || [];
          } else if (fieldDef && typeof fieldDef === 'object') {
            if (fieldDef.type && Array.isArray(fieldDef.type)) {
              this[key] = this[key] || [];
            }
            if ('default' in fieldDef && this[key] === undefined) {
              this[key] = typeof fieldDef.default === 'function' ? fieldDef.default.call(this) : fieldDef.default;
            }
          }
        }
      }
      
      if (schema && schema.methods) {
        for (const methodName of Object.keys(schema.methods)) {
          this[methodName] = schema.methods[methodName].bind(this);
        }
      }
    }
    
    isModified(field) {
      if (field === 'password' && this.password) {
        return !this.password.startsWith('$2a$') && !this.password.startsWith('$2b$');
      }
      return true;
    }
    
    async save() {
      if (schema && schema.hooks && schema.hooks.pre && schema.hooks.pre.save) {
        for (const hook of schema.hooks.pre.save) {
          await new Promise(async (resolve, reject) => {
            let called = false;
            const next = (err) => {
              if (called) return;
              called = true;
              if (err) reject(err);
              else resolve();
            };
            try {
              const res = hook.call(this, next);
              if (res && typeof res.then === 'function') {
                await res;
                next();
              } else if (hook.length === 0) {
                next();
              }
            } catch (err) {
              reject(err);
            }
          });
        }
      }
      
      const list = db[modelName];
      const idx = list.findIndex(item => item._id.toString() === this._id.toString());
      if (idx !== -1) {
        list[idx] = this;
      } else {
        list.push(this);
      }
      return this;
    }
    
    static async create(data) {
      if (Array.isArray(data)) {
        const docs = [];
        for (const item of data) {
          const doc = new Model(item);
          await doc.save();
          docs.push(doc);
        }
        return docs;
      } else {
        const doc = new Model(data);
        await doc.save();
        return doc;
      }
    }
    
    static find(query = {}) {
      return new Query(modelName, (doc) => matchQuery(doc, query));
    }
    
    static findOne(query = {}) {
      return new SingleQuery(modelName, (doc) => matchQuery(doc, query));
    }
    
    static findById(id) {
      return new SingleQuery(modelName, (doc) => doc._id.toString() === (id ? id.toString() : ''));
    }
    
    static countDocuments(query = {}) {
      return new CountQuery(modelName, (doc) => matchQuery(doc, query));
    }
    
    static async findByIdAndUpdate(id, update, options = {}) {
      const doc = await Model.findById(id);
      if (!doc) return null;
      
      if (schema && schema.hooks && schema.hooks.pre && schema.hooks.pre.findOneAndUpdate) {
        const queryMock = {
          getUpdate() { return update; }
        };
        for (const hook of schema.hooks.pre.findOneAndUpdate) {
          await new Promise(async (resolve, reject) => {
            let called = false;
            const next = (err) => {
              if (called) return;
              called = true;
              if (err) reject(err);
              else resolve();
            };
            try {
              const res = hook.call(queryMock, next);
              if (res && typeof res.then === 'function') {
                await res;
                next();
              } else if (hook.length === 0) {
                next();
              }
            } catch (err) {
              reject(err);
            }
          });
        }
      }
      
      for (const key of Object.keys(update)) {
        const val = update[key];
        if (val && typeof val === 'object' && val.$push) {
          doc[key] = doc[key] || [];
          const pushVal = val.$push;
          const pushStr = pushVal.toString();
          if (!doc[key].some(x => x.toString() === pushStr)) {
            doc[key].push(pushVal);
          }
        } else {
          doc[key] = val;
        }
      }
      doc.updatedAt = new Date();
      await doc.save();
      return doc;
    }
    
    static async findByIdAndDelete(id) {
      const list = db[modelName];
      const idx = list.findIndex(item => item._id.toString() === (id ? id.toString() : ''));
      if (idx !== -1) {
        const [deleted] = list.splice(idx, 1);
        return deleted;
      }
      return null;
    }
  }
  
  return Model;
}

const Types = {
  ObjectId: createObjectId
};

module.exports = {
  connect: async () => { return true; },
  Schema,
  model,
  Types,
  mongooseDbStore: db
};
