// One file per UI area keeps translation work (and merges) from colliding.
import { shell } from "./shell";
import { dashboard } from "./dashboard";
import { properties } from "./properties";
import { tenants } from "./tenants";
import { leases } from "./leases";
import { rent } from "./rent";
import { maintenance } from "./maintenance";
import { settings } from "./settings";
import { fiscal } from "./fiscal";

export const IT: Record<string, string> = {
  ...shell,
  ...dashboard,
  ...properties,
  ...tenants,
  ...leases,
  ...rent,
  ...maintenance,
  ...settings,
  ...fiscal,
};
