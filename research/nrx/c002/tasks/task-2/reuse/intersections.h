// Exact predicates on stored float coordinates, with a long-double filter.
// Fixed integers suffice: |coordinate|<=2, scaled by 2^149; degree-3
// determinants require fewer than 460 bits. No third-party predicate code.
struct ExactInt {
  std::array<uint64_t,8> words{}; int sign=0;
  static ExactInt number(double input){
    float f=float(input);uint32_t bits;std::memcpy(&bits,&f,4);
    uint32_t exponent=(bits>>23)&255,mantissa=bits&0x7fffff;
    require(std::isfinite(f)&&std::abs(f)<=4,"exact predicate range");
    if(exponent)mantissa|=1u<<23;
    ExactInt n;if(!mantissa)return n;n.sign=(bits>>31)?-1:1;
    unsigned shift=exponent?exponent-1:0,index=shift/64,offset=shift%64;
    n.words[index]=uint64_t(mantissa)<<offset;
    if(offset>40)n.words[index+1]=uint64_t(mantissa)>>(64-offset);
    return n;
  }
  int compare_abs(const ExactInt& b)const{for(int i=7;i>=0;i--)if(words[i]!=b.words[i])return words[i]>b.words[i]?1:-1;return 0;}
  ExactInt operator-()const{auto n=*this;n.sign=-n.sign;return n;}
  ExactInt operator+(const ExactInt& b)const{
    if(!sign){return b;}
    if(!b.sign){return *this;}
    ExactInt n;
    if(sign==b.sign){n.sign=sign;__uint128_t carry=0;for(int i=0;i<8;i++){__uint128_t sum=__uint128_t(words[i])+b.words[i]+carry;n.words[i]=uint64_t(sum);carry=sum>>64;}require(!carry,"exact integer overflow");}
    else {int cmp=compare_abs(b);if(!cmp)return n;auto& a=cmp>0?*this:b;auto& c=cmp>0?b:*this;n.sign=a.sign;uint64_t borrow=0;for(int i=0;i<8;i++){__uint128_t sub=__uint128_t(c.words[i])+borrow;n.words[i]=uint64_t(__uint128_t(a.words[i])-sub);borrow=__uint128_t(a.words[i])<sub;}}
    return n;
  }
  ExactInt operator-(const ExactInt& b)const{return *this+(-b);}
  ExactInt operator*(const ExactInt& b)const{
    ExactInt n;n.sign=sign*b.sign;if(!n.sign)return n;
    for(int i=0;i<8;i++){__uint128_t carry=0;for(int j=0;j<8-i;j++){__uint128_t sum=__uint128_t(words[i])*b.words[j]+n.words[i+j]+carry;n.words[i+j]=uint64_t(sum);carry=sum>>64;}require(!carry,"exact multiply overflow");}
    if(std::all_of(n.words.begin(),n.words.end(),[](uint64_t v){return v==0;}))n.sign=0;
    return n;
  }
};
bool equal_pos(V a,V b){return a.x==b.x&&a.y==b.y&&a.z==b.z;}
int orient3(V a,V b,V c,V d){
  if(equal_pos(a,b)||equal_pos(a,c)||equal_pos(a,d)||equal_pos(b,c)||equal_pos(b,d)||equal_pos(c,d))return 0;
  long double x[3]={static_cast<long double>(a.x)-d.x,static_cast<long double>(a.y)-d.y,static_cast<long double>(a.z)-d.z},y[3]={static_cast<long double>(b.x)-d.x,static_cast<long double>(b.y)-d.y,static_cast<long double>(b.z)-d.z},z[3]={static_cast<long double>(c.x)-d.x,static_cast<long double>(c.y)-d.y,static_cast<long double>(c.z)-d.z};
  long double terms[6]={x[0]*y[1]*z[2],x[1]*y[2]*z[0],x[2]*y[0]*z[1],-x[2]*y[1]*z[0],-x[1]*y[0]*z[2],-x[0]*y[2]*z[1]};
  long double sum=0,magnitude=0;for(auto v:terms){sum+=v;magnitude+=std::abs(v);}
  if(std::abs(sum)>magnitude*128*std::numeric_limits<long double>::epsilon())return sum>0?1:-1;
  std::array<ExactInt,3> u={ExactInt::number(a.x)-ExactInt::number(d.x),ExactInt::number(a.y)-ExactInt::number(d.y),ExactInt::number(a.z)-ExactInt::number(d.z)};
  std::array<ExactInt,3> v={ExactInt::number(b.x)-ExactInt::number(d.x),ExactInt::number(b.y)-ExactInt::number(d.y),ExactInt::number(b.z)-ExactInt::number(d.z)};
  std::array<ExactInt,3> w={ExactInt::number(c.x)-ExactInt::number(d.x),ExactInt::number(c.y)-ExactInt::number(d.y),ExactInt::number(c.z)-ExactInt::number(d.z)};
  return (u[0]*(v[1]*w[2]-v[2]*w[1])+u[1]*(v[2]*w[0]-v[0]*w[2])+u[2]*(v[0]*w[1]-v[1]*w[0])).sign;
}
std::pair<double,double> project2(V p,int axis){return axis==0?std::make_pair(p.y,p.z):axis==1?std::make_pair(p.x,p.z):std::make_pair(p.x,p.y);}
int orient2(V a,V b,V c,int axis){
  auto [ax,ay]=project2(a,axis);auto [bx,by]=project2(b,axis);auto [cx,cy]=project2(c,axis);
  long double p=(static_cast<long double>(ax)-cx)*(static_cast<long double>(by)-cy),q=(static_cast<long double>(ay)-cy)*(static_cast<long double>(bx)-cx);
  if(std::abs(p-q)>(std::abs(p)+std::abs(q))*64*std::numeric_limits<long double>::epsilon())return p>q?1:-1;
  return ((ExactInt::number(ax)-ExactInt::number(cx))*(ExactInt::number(by)-ExactInt::number(cy))-(ExactInt::number(ay)-ExactInt::number(cy))*(ExactInt::number(bx)-ExactInt::number(cx))).sign;
}
bool between(V p,V a,V b,int axis){auto [px,py]=project2(p,axis);auto [ax,ay]=project2(a,axis);auto [bx,by]=project2(b,axis);return px>=std::min(ax,bx)&&px<=std::max(ax,bx)&&py>=std::min(ay,by)&&py<=std::max(ay,by);}
bool allowed_point(V p,const std::vector<V>& shared){for(auto v:shared)if(equal_pos(p,v))return true;return false;}
bool point_in_triangle(V p,const Tri& t,int axis){int a=orient2(t.v[0].pos(),t.v[1].pos(),p,axis),b=orient2(t.v[1].pos(),t.v[2].pos(),p,axis),c=orient2(t.v[2].pos(),t.v[0].pos(),p,axis);return (a>=0&&b>=0&&c>=0)||(a<=0&&b<=0&&c<=0);}
bool coplanar_segment_bad(V a,V b,const Tri& t,int axis,const std::vector<V>& shared){
  if(point_in_triangle(a,t,axis)&&!allowed_point(a,shared))return true;
  if(point_in_triangle(b,t,axis)&&!allowed_point(b,shared))return true;
  for(int j=0;j<3;j++){
    V c=t.v[j].pos(),d=t.v[(j+1)%3].pos();int ac=orient2(a,b,c,axis),ad=orient2(a,b,d,axis),ca=orient2(c,d,a,axis),cb=orient2(c,d,b,axis);
    if(ac*ad<0&&ca*cb<0)return true;
    for(auto item:{std::make_pair(c,ac),std::make_pair(d,ad)})if(item.second==0&&between(item.first,a,b,axis)&&!allowed_point(item.first,shared))return true;
    for(auto item:{std::make_pair(a,ca),std::make_pair(b,cb)})if(item.second==0&&between(item.first,c,d,axis)&&!allowed_point(item.first,shared))return true;
    // Overlapping collinear intervals with two distinct contact points cannot
    // be excused by a single shared vertex.
    if(ac==0&&ad==0&&ca==0&&cb==0){std::vector<V> contact;for(auto p:{a,b})if(between(p,c,d,axis))contact.push_back(p);for(auto p:{c,d})if(between(p,a,b,axis))contact.push_back(p);if(contact.size()>1)for(auto p:contact)if(!equal_pos(p,contact[0])&&shared.size()<2)return true;}
  }
  return false;
}
bool segment_bad(V a,V b,const Tri& t,const std::vector<V>& shared){
  V p=t.v[0].pos(),q=t.v[1].pos(),r=t.v[2].pos();int sa=orient3(p,q,r,a),sb=orient3(p,q,r,b);if(sa*sb>0)return false;
  V n=cross(q-p,r-p);int axis=std::abs(n.x)>=std::abs(n.y)&&std::abs(n.x)>=std::abs(n.z)?0:std::abs(n.y)>=std::abs(n.z)?1:2;
  if(sa==0&&sb==0)return coplanar_segment_bad(a,b,t,axis,shared);
  if(sa==0)return point_in_triangle(a,t,axis)&&!allowed_point(a,shared);
  if(sb==0)return point_in_triangle(b,t,axis)&&!allowed_point(b,shared);
  int x=orient3(a,b,p,q),y=orient3(a,b,q,r),z=orient3(a,b,r,p);
  return (x>=0&&y>=0&&z>=0)||(x<=0&&y<=0&&z<=0);
}
bool bad_contact(const Tri& a,const Tri& b){
  std::vector<V> shared;for(auto& u:a.v)for(auto& v:b.v)if(u.key==v.key)shared.push_back(u.pos());
  if(shared.size()==3)return true;
  if(shared.size()==2){V othera{},otherb{};for(auto& v:a.v)if(!allowed_point(v.pos(),shared))othera=v.pos();for(auto& v:b.v)if(!allowed_point(v.pos(),shared))otherb=v.pos();if(orient3(shared[0],shared[1],othera,otherb)!=0)return false;V n=cross(shared[1]-shared[0],othera-shared[0]);int axis=std::abs(n.x)>=std::abs(n.y)&&std::abs(n.x)>=std::abs(n.z)?0:std::abs(n.y)>=std::abs(n.z)?1:2;return orient2(shared[0],shared[1],othera,axis)*orient2(shared[0],shared[1],otherb,axis)>=0;}
  for(int j=0;j<3;j++)if(segment_bad(a.v[j].pos(),a.v[(j+1)%3].pos(),b,shared)||segment_bad(b.v[j].pos(),b.v[(j+1)%3].pos(),a,shared))return true;
  return false;
}
bool overlap(const Box& a,const Box& b){return a.lo.x<=b.hi.x&&a.hi.x>=b.lo.x&&a.lo.y<=b.hi.y&&a.hi.y>=b.lo.y&&a.lo.z<=b.hi.z&&a.hi.z>=b.lo.z;}
uint64_t validate_contacts(const std::vector<Tri>& triangles){
  BVH tree(triangles);uint64_t pairs=0;
  for(size_t i=0;i<triangles.size();i++){
    Box box;for(auto& v:triangles[i].v)box.add(v.pos());std::vector<int> pending{0};
    while(!pending.empty()){int k=pending.back();pending.pop_back();auto& e=tree.entries[k];if(!overlap(box,e.box))continue;
      if(e.left>=0){pending.push_back(e.left);pending.push_back(e.right);continue;}
      for(size_t j=e.begin;j<e.end;j++){size_t other=tree.order[j];if(other<=i)continue;Box ob;for(auto& v:triangles[other].v)ob.add(v.pos());if(!overlap(box,ob))continue;++pairs;if(bad_contact(triangles[i],triangles[other])){std::cerr<<"contact triangles "<<triangles[i].id<<" "<<triangles[other].id<<"\\n";throw std::runtime_error("forbidden triangle contact");}}
    }
  }return pairs;
}
