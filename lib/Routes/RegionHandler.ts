import { Response, RequestHandler } from 'express';
import { Store } from '../Store';
import { Config } from '../Config';
import { IRegion, IHost, IEstate, IUser } from '../types';
import { AuthenticatedRequest } from '../Auth';
import { Set } from 'immutable';
import { RegionLogs } from '../regionLogs';
import Promise = require('bluebird');
import { PerformanceStore } from '../Performance';
import * as formstream from 'formstream';

import { RemoveRegionFromHost, PutRegionOnHost, StopRegion, KillRegion, StartRegion } from '../Region';

export function GetRegionsHandler(store: Store, perf: PerformanceStore): RequestHandler {
  return function (req: AuthenticatedRequest, res: Response) {
    store.Regions.getAll().then((regions: IRegion[]) => {
      return regions.filter((r: IRegion) => {
        return req.user.isAdmin || req.user.regions.has(r.uuid);
      });
    }).then((regions: IRegion[]) => {
      return Promise.all(regions.map((r: IRegion) => {
        return perf.getRegionData(r).then((data: string) => {
          r.status = data;
        });
      })).then(() => { return regions; })
    }).then((regions: IRegion[]) => {
      res.json({
        Success: true,
        Regions: regions
      });
    }).catch((err: Error) => {
      res.json({
        Success: false,
        Message: err.message
      });
    });
  }
}

export function StartRegionHandler(store: Store, conf: Config): RequestHandler {
  return (req: AuthenticatedRequest, res) => {
    let regionID = req.params.uuid;
    let r: IRegion

    if (!req.user.isAdmin && !req.user.regions.has(regionID))
      return res.json({ Success: false, Message: 'Permission Denied' });

    store.Regions.getByUUID(regionID.toString()).then((region: IRegion) => {
      r = region;
      return store.Hosts.getByAddress(r.node);
    }).then((h: IHost) => {
      return StartRegion(r, h, conf);
    }).then(() => {
      res.json({ Success: true });
    }).catch((err: Error) => {
      res.json({ Success: false, Message: err.message });
    })
  };
}


export function StopRegionHandler(store: Store, perf: PerformanceStore): RequestHandler {
  return (req: AuthenticatedRequest, res) => {
    let regionID = req.params.uuid;
    let region: IRegion

    if (!req.user.isAdmin && !req.user.regions.has(regionID))
      return res.json({ Success: false, Message: 'Permission Denied' });

    store.Regions.getByUUID(regionID.toString()).then((r: IRegion) => {
      return perf.isRegionRunning(r).then((isRunning: boolean) => {
        if (!isRunning)
          throw new Error('Region ' + r.name + ' is not running');
        if (!r.node) {
          throw new Error('Region ' + r.name + ' is marked as running, but is not assigned to a host');
        }
        region = r;
        return store.Users.getByID(req.user.uuid);
      });
    }).then((u: IUser) => {
      return StopRegion(region, u);
    }).then(() => {
      res.json({ Success: true });
    }).catch((err) => {
      res.json({ Success: false, Message: err.message });
    });
  };
}

export function KillRegionHandler(store: Store, perf: PerformanceStore): RequestHandler {
  return (req: AuthenticatedRequest, res) => {
    let regionID = req.params.uuid;
    let target: IRegion;

    if (!req.user.isAdmin && !req.user.regions.has(regionID))
      return res.json({ Success: false, Message: 'Permission Denied' });

    store.Regions.getByUUID(regionID.toString()).then((r: IRegion) => {
      return perf.isRegionRunning(r).then((isRunning: boolean) => {
        if (!isRunning)
          throw new Error('Region ' + r.name + ' is not running');
        if (!r.node)
          throw new Error('Region ' + r.name + ' is marked as running, but is not assigned to a host');
        target = r;
        return store.Hosts.getByAddress(r.node);
      });
    }).then((h: IHost) => {
      return KillRegion(target, h);
    }).then(() => {
      res.json({ Success: true });
    }).catch((err) => {
      res.json({ Success: false, Message: err.message });
    });
  };
}


export function GetRegionLogsHandler(store: Store, logger: RegionLogs): RequestHandler {
  return function (req: AuthenticatedRequest, res: Response) {
    let regionID = req.params.uuid;

    if (!req.user.isAdmin && !req.user.regions.has(regionID))
      return res.json({ Success: false, Message: 'Permission Denied' });

    store.Regions.getByUUID(regionID).then((r: IRegion) => {
      return logger.getLogs(r);
    }).then((log: string) => {
      res.json({
        Success: true,
        Message: log
      });
    }).catch((err: Error) => {
      res.json({ Success: false, Message: err.message });
    });
  }
}

export function SetRegionEstateHandler(store: Store): RequestHandler {
  return (req: AuthenticatedRequest, res) => {
    let regionID = req.params.uuid;
    let estateID: number = parseInt(req.body.estate);

    let estate: IEstate;

    if (!req.user.isAdmin && !req.user.regions.has(regionID))
      return res.json({ Success: false, Message: 'Permission Denied' });

    //confirm the components exist
    store.Estates.getById(estateID).then((e: IEstate) => {
      //confirmed
      estate = e;
      return store.Regions.getByUUID(regionID.toString());
    }).then((r: IRegion) => {
      //confirmed
      return store.Estates.setEstateForRegion(estate, r);
    }).then(() => {
      res.json({ Success: true });
    }).catch((err: Error) => {
      res.json({ Success: false, Message: err.message });
    });
  };
}

export function SetRegionCoordinatesHandler(store: Store, perf: PerformanceStore): RequestHandler {
  return (req: AuthenticatedRequest, res) => {
    let regionID = req.params.uuid;
    let x = parseInt(req.body.x);
    let y = parseInt(req.body.y);

    if (!req.user.isAdmin && !req.user.regions.has(regionID))
      return res.json({ Success: false, Message: 'Permission Denied' });

    store.Regions.getAll().then((regions: IRegion[]) => {
      let region: IRegion;
      for (let r of regions) {
        if (r.x === x && r.y === y) throw new Error('Those coordinates are not available');
        if (r.uuid === regionID) region = r;
      }
      return region;
    }).then((r: IRegion) => {
      return perf.isRegionRunning(r).then((isRunning: boolean) => {
        if (isRunning)
          throw new Error('Cannot move a region while it is running');
      }).then(() => {
        return store.Regions.setXY(r, x, y);
      });
    }).then(() => {
      res.json({ Success: true });
    }).catch((err: Error) => {
      res.json({ Success: false, Message: err.message });
    });
  };
}

export function SetRegionHostHandler(store: Store, perf: PerformanceStore): RequestHandler {
  return (req: AuthenticatedRequest, res) => {
    let regionID = req.params.uuid;
    let hostAddress: string = req.body.host || '';
    let region: IRegion;
    let newHost: IHost;
    let currentHost: IHost;

    if (!req.user.isAdmin && !req.user.regions.has(regionID))
      return res.json({ Success: false, Message: 'Permission Denied' });

    // MGM Now assigns port numbers, check for available ports before making switch
    store.Regions.getByUUID(regionID.toString()).then((r: IRegion) => {
      region = r;
      // easy out if no change
      if (r.node === hostAddress) {
        throw new Error('Region is already on that host');
      }

      return perf.isRegionRunning(r).then((isRunning: boolean) => {
        if (isRunning) throw new Error('Region is currently running');
      });
    }).then(() => {
      // Lookup the current host record
      if (region.node)
        return store.Hosts.getByAddress(region.node)
      return null;
    }).then((h: IHost) => {
      currentHost = h;
      // Lookup the new Host Record
      if (hostAddress)
        return store.Hosts.getByAddress(hostAddress);
      else
        return null
    }).then((h: IHost) => {
      newHost = h;
      if (!h)
        return Promise.resolve(null);

      console.log('checking ports for ' + h.address);

      //check and assign port
      let parts = h.slots.split('-');
      let minPort = parseInt(parts[0]);
      let maxPort = parseInt(parts[1]);
      let availableports = []
      for (let i = minPort; i <= maxPort; i++)
        availableports.push(i);

      return store.Regions.getByNode(h).then((regions: IRegion[]) => {
        for (let rgn of regions) {
          let idx = availableports.indexOf(rgn.port);
          if (idx > -1)
            availableports.splice(idx, 1);
        }
      }).then(() => {
        if (availableports.length < 1)
          throw new Error('No available ports on host');
        return availableports[0];
      });
    }).then((port: number) => {
      // we are clear to move, place region on new host
      console.log('selected port: ' + port + ', moving to host');
      if (currentHost) {
        console.log('Removing region from host ' + currentHost.address);
        RemoveRegionFromHost(region, currentHost);
      }
      if (newHost) {
        return store.Regions.setHost(region, newHost, port).then(() => {
          console.log('Adding region to host ' + newHost.address);
          return PutRegionOnHost(store, region, newHost);
        });
      } else {
        return store.Regions.setHost(region, null, null).then(() => { });
      }
    }).then(() => {
      res.json({ Success: true });
    }).catch((err: Error) => {
      console.log(err);
      res.json({ Success: false, Message: err.message });
    });
  };
}

export function CreateRegionHandler(store: Store): RequestHandler {
  return (req: AuthenticatedRequest, res) => {
    let name = req.body.name;

    if (!req.body.x || isNaN(parseInt(req.body.x, 10))) return res.json({ Success: false, Message: "Integer X coordinate required" });
    if (!req.body.y || isNaN(parseInt(req.body.y, 10))) return res.json({ Success: false, Message: "Integer Y coordinate required" });
    if (!name) return res.json({ Success: false, Message: "Region name cannot be blank" });
    if (!req.body.estate || isNaN(parseInt(req.body.estate, 10))) return res.json({ Success: false, Message: "Invalid Estate Assignment" });

    let estateID = parseInt(req.body.estate, 10);
    let x = parseInt(req.body.x, 10);
    let y = parseInt(req.body.y, 10);

    if (x < 0 || y < 0)
      return res.json({ Success: false, Message: "Invalid region coordinates" });

    let newRegion: IRegion;
    let newEstate: IEstate;

    store.Estates.getById(estateID).then((e: IEstate) => {
      newEstate = e;
      return store.Regions.getAll();
    }).then((regions: IRegion[]) => {
      regions.map((r: IRegion) => {
        if (r.name === name) throw new Error('That region name is already taken');
        if (r.x === x && r.y === y) throw new Error('Those coordinates are not available');
      });
      return Promise.resolve();
    }).then(() => {
      return store.Regions.create(name, x, y);
    }).then((r: IRegion) => {
      newRegion = r;
      return store.Estates.setEstateForRegion(newEstate, r);
    }).then(() => {
      return res.json({ Success: true, Message: newRegion.uuid });
    }).catch((err: Error) => {
      res.json({ Success: false, Message: err.message });
      console.log(err);
    });
  };
}

export function DeleteRegionHandler(store: Store, perf: PerformanceStore): RequestHandler {
  return (req: AuthenticatedRequest, res) => {
    let regionID = req.params.uuid;

    store.Regions.getByUUID(regionID).then((r: IRegion) => {
      if (r.node)
        throw new Error('region is still allocated a host');
      return perf.isRegionRunning(regionID).then((isRunning: boolean) => {
        if (isRunning)
          throw new Error('cannot delete a running region');
      }).then(() => {
        return store.Regions.delete(r);
      });
    }).then(() => {
      res.json({ Success: true });
    }).catch((err: Error) => {
      res.json({ Success: false, Message: err.message });
    });
  };
}