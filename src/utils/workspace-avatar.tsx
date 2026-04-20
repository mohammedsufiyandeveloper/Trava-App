const GradientAvatar = ({ name }: { name: string }) => {
  const firstLetter = name?.charAt(0).toUpperCase() ?? "W";

  // pick 1 gradient based on the name (consistent)
  const gradients = [
    "from-pink-500 to-violet-500",
    "from-purple-500 to-indigo-500",
    "from-blue-500 to-cyan-500",
    "from-green-500 to-emerald-500",
    "from-orange-500 to-red-500",
  ];

  const index = name.length % gradients.length;
  const gradient = gradients[index];

  return (
    <div
      className={`h-8 w-8 flex items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-white font-semibold`}
    >
      {firstLetter}
    </div>
  );
};
export default GradientAvatar;
