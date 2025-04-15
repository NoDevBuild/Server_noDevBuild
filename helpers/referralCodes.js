export const referralCodes = [
  {
    code: "OFF75",
    discountPercent: 75,
    expiryDate: "28-04-2026",
    isActive: true,
    acceptedPlans: ["premiumPlan", "basicPlan"]
  },
  {
    code: "OFF99",
    discountPercent: 99,
    expiryDate: "28-04-2026",
    isActive: true,
    acceptedPlans: ["premiumPlan", "basicPlan"]
  },
  // Add more referral codes as needed
];

export const verifyReferralCode = (code, planType) => {
  const referral = referralCodes.find(ref => 
    ref.code === code && 
    ref.isActive
  );

  if (!referral) {
    return {
      isValid: false,
      error: "Invalid referral code"
    };
  }

  // Convert expiry date string to Date object for comparison
  const [day, month, year] = referral.expiryDate.split('-');
  const expiryDate = new Date(`${year}-${month}-${day}`);
  const currentDate = new Date();

  if (currentDate > expiryDate) {
    return {
      isValid: false,
      error: "Referral code has expired"
    };
  }

  // Check if the plan type is accepted by this referral code
  if (!referral.acceptedPlans.includes(planType)) {
    return {
      isValid: false,
      error: `This referral code is not valid for ${planType}`
    };
  }

  // Calculate the amount to be paid
  const originalAmount = planType === 'basicPlan' ? 1800 : 5000;
  const discountAmount = (originalAmount * referral.discountPercent) / 100;
  const amountToPay = originalAmount - discountAmount;

  return {
    isValid: true,
    discountPercent: referral.discountPercent,
    amountToPay: amountToPay,
    acceptedPlans: referral.acceptedPlans,
    planType: planType,
    expiryDate: referral.expiryDate
  };
}; 