const cron = require("node-cron");
const Blog = require("../Models/BlogModel");

cron.schedule("* * * * *", async () => {
  const now = new Date();

  await Blog.updateMany(
    {
      status: "scheduled",
      publishDate: { $lte: now },
    },
    {
      status: "published",
      publishedAt: now,
    }
  );
});
