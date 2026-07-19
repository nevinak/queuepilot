const predictionService = require('../services/predictionService');

describe('PredictionService', () => {
  it('calculates EMA correctly', () => {
    const result = predictionService.calculateEma(10, 12, 0.5);
    expect(result).toBe(11);
  });

  it('builds a prediction snapshot with defaults', () => {
    const snapshot = predictionService.buildPredictionSnapshot({}, 8, 2);
    expect(snapshot.currentAverage).toBe(8);
    expect(snapshot.patientsAhead).toBe(2);
  });
});
