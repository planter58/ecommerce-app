import { useEffect, useState, useContext } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { fetchProduct } from '../api/products';
import { fetchProductReviews, addProductReview } from '../api/reviews';
import { AuthContext } from '../context/AuthContext.jsx';

export default function ProductReviews() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ rating: 5, comment: '' });
  const [error, setError] = useState('');
  const hasReviewed = !!(user && reviews && reviews.some(r => (r.user_id === user.id) || (r.userId === user.id) || (r.user && r.user.id === user.id)));

  const load = async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([
        fetchProduct(id),
        fetchProductReviews(id)
      ]);
      setProduct(p);
      setReviews(r || []);
    } catch (e) {
      // keep minimal error handling
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!user) {
      navigate('/login', { replace: false });
      return;
    }
    if (hasReviewed) {
      setError('You have already submitted a review for this product.');
      return;
    }
    if (!form.rating || form.rating < 1 || form.rating > 5) {
      setError('Please select a rating between 1 and 5.');
      return;
    }
    if (!form.comment || form.comment.trim().length < 3) {
      setError('Please write a short review (at least 3 characters).');
      return;
    }
    setSubmitting(true);
    try {
      await addProductReview(id, { rating: form.rating, comment: form.comment.trim() });
      setForm({ rating: 5, comment: '' });
      await load();
    } catch (e) {
      setError('Could not submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Loading reviews...</div>;
  if (!product) return <div>Product not found.</div>;

  const avg = reviews.length ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length) : 0;

  return (
    <div className="product-reviews">
      <div className="breadcrumbs small" style={{ marginBottom: 12 }}>
        <Link to={`/product/${product.id}`}>{product.title}</Link> <span className="muted">/</span> <strong>Reviews</strong>
      </div>
      <h2 style={{ marginTop: 0 }}>Reviews for {product.title}</h2>
      <div className="small muted" style={{ margin: '6px 0 16px 0' }}>
        Average rating: {avg.toFixed(2)} / 5 ({reviews.length} reviews)
      </div>

      <div className="stack" style={{ gap: 12 }}>
        {reviews.length === 0 && (
          <div className="card" style={{ padding: 12 }}>No reviews yet. Be the first to review this product.</div>
        )}
        {reviews.map((r) => (
          <div key={r.id} className="card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <strong>{r.user_name || 'Customer'}</strong>
              <span>{'★'.repeat(r.rating)}{'☆'.repeat(Math.max(0, 5 - r.rating))}</span>
            </div>
            {r.comment && <div className="mt-8">{r.comment}</div>}
            <div className="small mt-8 muted">{new Date(r.created_at).toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="mt-24">
        <h3 style={{ marginBottom: 8 }}>Write a review</h3>
        {!user && (
          <div className="small" style={{ marginBottom: 8 }}>
            <Link to="/login">Login</Link> to post a review.
          </div>
        )}
        {hasReviewed && (
          <div className="card" style={{ padding: 12, maxWidth: 640, marginBottom: 12 }}>
            <div className="small">You have already reviewed this product. Thank you!</div>
          </div>
        )}
        <form onSubmit={onSubmit} className="card" style={{ padding: 12, maxWidth: 640, opacity: hasReviewed ? 0.6 : 1, pointerEvents: hasReviewed ? 'none' : 'auto' }}>
          {error && <div className="error" style={{ color: 'crimson', marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label htmlFor="rating">Rating:</label>
            <select
              id="rating"
              value={form.rating}
              onChange={(e)=>setForm(f=>({ ...f, rating: Number(e.target.value) }))}
              className="input"
              style={{ width: 80 }}
              disabled={hasReviewed}
            >
              {[5,4,3,2,1].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="mt-8">
            <label htmlFor="comment">Comment:</label>
            <textarea
              id="comment"
              className="input"
              rows={4}
              value={form.comment}
              onChange={(e)=>setForm(f=>({ ...f, comment: e.target.value }))}
              placeholder="Share your experience with this product"
              style={{ width: '100%', resize: 'vertical' }}
              disabled={hasReviewed}
            />
          </div>
          <div className="mt-12">
            <button className="button" type="submit" disabled={submitting || hasReviewed}>{submitting ? 'Submitting...' : 'Submit Review'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
