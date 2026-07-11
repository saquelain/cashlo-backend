import Blog from '../models/Blog.js';

const PUBLIC_POPULATE = [
  { path: 'category', select: 'name slug' },
  { path: 'relatedPosts', select: 'title slug excerpt coverImage' },
];

export const getAllBlogs = async (query = {}) => {
  const {
    page = 1,
    limit = 10,
    category,
    tag,
    search,
    isPublished,
  } = query;

  const filter = {};

  // Public route defaults to published-only; admin route passes isPublished explicitly if needed
  if (isPublished !== undefined) {
    filter.isPublished = isPublished === 'true' || isPublished === true;
  }

  if (category) filter.category = category;
  if (tag) filter.tags = tag;
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { excerpt: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [blogs, total] = await Promise.all([
    Blog.find(filter)
      .populate(PUBLIC_POPULATE)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Blog.countDocuments(filter),
  ]);

  return {
    blogs,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
  };
};

export const getBlogBySlug = async (slug) => {
  const blog = await Blog.findOne({ slug, isPublished: true }).populate(PUBLIC_POPULATE);
  if (!blog) {
    const err = new Error('Blog not found');
    err.statusCode = 404;
    throw err;
  }
  return blog;
};

export const getBlogById = async (id) => {
  const blog = await Blog.findById(id).populate(PUBLIC_POPULATE);
  if (!blog) {
    const err = new Error('Blog not found');
    err.statusCode = 404;
    throw err;
  }
  return blog;
};

export const createBlog = async (data, userId) => {
  const payload = { ...data, createdBy: userId };
  if (payload.isPublished && !payload.publishedAt) {
    payload.publishedAt = new Date();
  }
  return Blog.create(payload);
};

export const updateBlog = async (id, data) => {
  const existing = await Blog.findById(id);
  if (!existing) {
    const err = new Error('Blog not found');
    err.statusCode = 404;
    throw err;
  }

  // Set publishedAt the first time a blog transitions to published
  if (data.isPublished && !existing.isPublished && !existing.publishedAt) {
    data.publishedAt = new Date();
  }

  const blog = await Blog.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).populate(PUBLIC_POPULATE);

  return blog;
};

export const deleteBlog = async (id) => {
  const blog = await Blog.findByIdAndDelete(id);
  if (!blog) {
    const err = new Error('Blog not found');
    err.statusCode = 404;
    throw err;
  }
  return blog;
};

export const getBlogsGroupedByCategory = async () => {
    const blogs = await Blog.find({ isPublished: true })
      .populate(PUBLIC_POPULATE)
      .sort({ publishedAt: -1 });
  
    const groups = new Map();
  
    for (const blog of blogs) {
      const cat = blog.category;
      if (!cat) continue;
      const key = cat._id.toString();
  
      if (!groups.has(key)) {
        groups.set(key, { category: cat, blogs: [] });
      }
      groups.get(key).blogs.push(blog);
    }
  
    return Array.from(groups.values());
};