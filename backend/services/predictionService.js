class PredictionService {
  calculateEma(previousAverage, latestDuration, alpha = 0.3) {
    return Number(((previousAverage * (1 - alpha)) + (latestDuration * alpha)).toFixed(1));
  }

  buildPredictionSnapshot(entry, doctorAverage, position = 0) {
    const previousAverage = entry.previousAverage || doctorAverage || 8;
    const latestDuration = entry.latestDuration || doctorAverage || 8;
    const currentAverage = entry.currentAverage || this.calculateEma(previousAverage, latestDuration);

    return {
      previousAverage,
      latestDuration,
      currentAverage,
      eta: entry.eta || 'Calculating',
      remainingWaitingTime: entry.remainingWaitingTime || 0,
      patientsAhead: entry.patientsAhead ?? position,
      departureRecommendation: entry.departureRecommendation || 'Plan your departure'
    };
  }
}

module.exports = new PredictionService();
