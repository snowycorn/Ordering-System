import { FactoryZonesController } from './factory-zones.controller';
import { FACTORY_ZONES } from '../factory-zones.constant';

describe('FactoryZonesController', () => {
  let controller: FactoryZonesController;

  beforeEach(() => {
    controller = new FactoryZonesController();
  });

  it('should return the full FACTORY_ZONES list', () => {
    expect(controller.getFactoryZones()).toBe(FACTORY_ZONES);
  });
});
