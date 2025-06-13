import { db, auth } from '../firebase/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc,
  updateDoc, 
  runTransaction,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';

class UserService {
  // Get all users from the database with improved mapping
  async getAllUsers() {
    try {
      console.log('Getting all users from Firestore');
      const usersCollection = collection(db, 'Users');
      const userSnapshot = await getDocs(usersCollection);
      
      if (userSnapshot.empty) {
        console.log('No users found in the database');
        return [];
      }
      
      // Map Firestore documents to user objects
      const users = userSnapshot.docs.map(doc => {
        const data = doc.data();
        
        // Normalize field names with proper fallbacks
        return {
          id: doc.id, // Use the document ID as the primary ID
          uid: doc.id, // Also include uid for compatibility
          email: data.Email || data.email || '',
          firstName: data.FirstName || data.firstName || '',
          lastName: data.LastName || data.lastName || '',
          UserBalance: data.UserBalance || data.userBalance || 0,
          phoneNumber: data.PhoneNumber || data.phoneNumber || '',
          username: data.Username || data.username || '',
          gender: data.Gender || data.gender || '',
          profilePicture: data.ProfilePicture || data.profilePicture || '',
          enrolledCourses: data.enrolledCourses || [],
          completedCourses: data.completedCourses || [],
          lastActive: data.lastActive || serverTimestamp(),
          role: data.role || 'student',
          createdAt: data.createdAt || null,
          ...data // Include all original fields just in case
        };
      });
      
      console.log(`Retrieved ${users.length} users from Firestore`);
      console.log('Sample user:', users.length > 0 ? users[0] : 'No users');
      
      return users;
    } catch (error) {
      console.error('Error getting users:', error);
      throw error;
    }
  }

  // Get user by ID with improved error handling
  async getUserById(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      console.log(`Getting user with ID: ${userId}`);
      const userDoc = await getDoc(doc(db, 'Users', userId));
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          id: userDoc.id,
          uid: userDoc.id,
          email: data.Email || data.email || '',
          firstName: data.FirstName || data.firstName || '',
          lastName: data.LastName || data.lastName || '',
          UserBalance: data.UserBalance || data.userBalance || 0,
          phoneNumber: data.PhoneNumber || data.phoneNumber || '',
          username: data.Username || data.username || '',
          gender: data.Gender || data.gender || '',
          profilePicture: data.ProfilePicture || data.profilePicture || '',
          enrolledCourses: data.enrolledCourses || [],
          completedCourses: data.completedCourses || [],
          lastActive: data.lastActive || null,
          role: data.role || 'student',
          createdAt: data.createdAt || null,
          ...data
        };
      } else {
        throw new Error(`User with ID ${userId} not found`);
      }
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  // Get current user
  async getCurrentUser() {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('No authenticated user');
      }
      
      return this.getUserById(currentUser.uid);
    } catch (error) {
      console.error('Error getting current user:', error);
      throw error;
    }
  }

  // Update user balance with improved transaction handling
  async updateUserBalance(userId, amount) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      if (isNaN(amount) || amount === 0) {
        throw new Error('Valid amount is required');
      }
      
      console.log(`Updating user ${userId} balance by ${amount}`);
      const userRef = doc(db, 'Users', userId);
      
      // Using transaction to ensure data consistency
      return await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) {
          throw new Error(`User with ID ${userId} does not exist`);
        }
        
        // Check if we're using "UserBalance" or "userBalance" field name
        const data = userDoc.data();
        const currentBalance = data.UserBalance !== undefined 
          ? data.UserBalance 
          : (data.userBalance || 0);
          
        const newBalance = currentBalance + amount;
        
        if (newBalance < 0) {
          throw new Error('Insufficient balance');
        }
        
        console.log(`Current balance: ${currentBalance}, New balance: ${newBalance}`);
        
        // Add transaction record
        const transactionRef = doc(collection(db, 'UserTransactions'));
        transaction.set(transactionRef, {
          userId: userId,
          amount: amount,
          beforeBalance: currentBalance,
          afterBalance: newBalance,
          type: amount > 0 ? 'deposit' : 'withdrawal',
          description: amount > 0 ? 'Balance added by admin' : 'Balance withdrawal',
          timestamp: serverTimestamp(),
          processedBy: auth.currentUser ? auth.currentUser.uid : 'system'
        });
        
        // Update using the same field name format that exists in the document
        if (data.UserBalance !== undefined) {
          transaction.update(userRef, { 
            UserBalance: newBalance,
            lastUpdated: serverTimestamp() 
          });
        } else {
          transaction.update(userRef, { 
            userBalance: newBalance,
            lastUpdated: serverTimestamp()
          });
        }
        
        // Also update secondary stats collection
        const statsRef = doc(db, `UserStats`, userId);
        transaction.set(statsRef, {
          lastBalanceUpdate: serverTimestamp(),
          currentBalance: newBalance,
          totalDeposits: amount > 0 ? increment(amount) : increment(0),
          totalWithdrawals: amount < 0 ? increment(Math.abs(amount)) : increment(0)
        }, { merge: true });
        
        return {
          success: true,
          previousBalance: currentBalance,
          newBalance: newBalance,
          amount: amount
        };
      });
    } catch (error) {
      console.error('Error updating user balance:', error);
      throw error;
    }
  }

  // Get user transaction history
  async getUserTransactionHistory(userId, limit = 10) {
    try {
      if (!userId) {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error('No authenticated user');
        }
        userId = currentUser.uid;
      }
      
      const transactionsQuery = query(
        collection(db, 'UserTransactions'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limit)
      );
      
      const snapshot = await getDocs(transactionsQuery);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting user transaction history:', error);
      throw error;
    }
  }

  // Search users by email or name with improved matching
  async searchUsers(searchTerm) {
    try {
      if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim() === '') {
        return [];
      }
      
      console.log(`Searching users with term: ${searchTerm}`);
      // Get all users first
      const users = await this.getAllUsers();
      
      // Filter users by email or name (case-insensitive)
      const term = searchTerm.toLowerCase().trim();
      
      return users.filter(user => {
        const email = (user.email || '').toLowerCase();
        const firstName = (user.firstName || '').toLowerCase();
        const lastName = (user.lastName || '').toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim();
        const username = (user.username || '').toLowerCase();
        const phone = (user.phoneNumber || '').toLowerCase();
        
        return email.includes(term) || 
               fullName.includes(term) || 
               firstName.includes(term) || 
               lastName.includes(term) ||
               username.includes(term) ||
               phone.includes(term);
      });
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }

  // Update user profile with enhanced fields
  async updateUserProfile(userId, userData) {
    try {
      if (!userId) {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error('No authenticated user');
        }
        userId = currentUser.uid;
      }
      
      console.log(`Updating profile for user ${userId}`);
      const userRef = doc(db, 'Users', userId);
      
      // Properly format field names to match existing convention
      const formattedData = {};
      
      // Map common fields to their proper casing
      const fieldMap = {
        firstName: 'FirstName',
        lastName: 'LastName',
        email: 'Email',
        phoneNumber: 'PhoneNumber',
        username: 'Username',
        gender: 'Gender',
        profilePicture: 'ProfilePicture'
      };
      
      // Process each field in userData
      for (const [key, value] of Object.entries(userData)) {
        if (fieldMap[key]) {
          // This is a known field, use proper casing
          formattedData[fieldMap[key]] = value;
        } else {
          // Unknown field, leave as is
          formattedData[key] = value;
        }
      }
      
      // Add updatedAt timestamp
      formattedData.updatedAt = serverTimestamp();
      
      await updateDoc(userRef, formattedData);
      
      console.log('User profile updated successfully');
      return {
        success: true,
        message: 'Profile updated successfully'
      };
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  // Track user course completion
  async trackCourseCompletion(userId, courseId, courseTitle) {
    try {
      if (!userId || !courseId) {
        throw new Error('User ID and Course ID are required');
      }
      
      console.log(`Tracking course completion for user ${userId}, course ${courseId}`);
      const userRef = doc(db, 'Users', userId);
      
      // Update user document
      await updateDoc(userRef, {
        completedCourses: arrayUnion({
          courseId,
          courseTitle,
          completedAt: new Date().toISOString()
        }),
        lastActive: serverTimestamp()
      });
      
      // Add to user achievements
      const achievementRef = doc(collection(db, `UserTasks/${userId}/Achievements`));
      await setDoc(achievementRef, {
        type: 'course_completion',
        courseId,
        courseTitle,
        achievedAt: serverTimestamp(),
        certificateId: `CERT-${Date.now()}`
      });
      
      console.log('Course completion tracked successfully');
      return true;
    } catch (error) {
      console.error('Error tracking course completion:', error);
      throw error;
    }
  }

  // Get user progress overview (all courses)
  async getUserProgressOverview(userId = null) {
    try {
      if (!userId) {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error('No authenticated user');
        }
        userId = currentUser.uid;
      }
      
      // Get all enrollments for this user
      const enrollmentsQuery = query(
        collection(db, 'Enrollments'),
        where('userId', '==', userId)
      );
      
      const snapshot = await getDocs(enrollmentsQuery);
      
      if (snapshot.empty) {
        return [];
      }
      
      // Process enrollments to get progress data
      const courseProgressData = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const enrollmentData = doc.data();
          
          // Get course data
          try {
            const courseDoc = await getDoc(doc(db, 'Courses', enrollmentData.courseId));
            if (courseDoc.exists()) {
              const courseData = courseDoc.data();
              
              return {
                courseId: enrollmentData.courseId,
                courseTitle: courseData.title || enrollmentData.courseTitle,
                enrolledAt: enrollmentData.enrolledAt,
                lastAccessed: enrollmentData.lastAccessed,
                progress: enrollmentData.progress || 0,
                isCompleted: enrollmentData.isCompleted || false,
                completedLessons: enrollmentData.completedLessons || 0,
                totalLessons: enrollmentData.totalLessons || courseData.lessons?.length || 0,
                courseImage: courseData.imageUrl || '',
                category: courseData.categoryId || ''
              };
            }
          } catch (error) {
            console.error(`Error getting course data for enrollment ${doc.id}:`, error);
          }
          
          // Fallback if course not found
          return {
            courseId: enrollmentData.courseId,
            courseTitle: enrollmentData.courseTitle || 'Unknown Course',
            enrolledAt: enrollmentData.enrolledAt,
            lastAccessed: enrollmentData.lastAccessed,
            progress: enrollmentData.progress || 0,
            isCompleted: enrollmentData.isCompleted || false,
            completedLessons: enrollmentData.completedLessons || 0,
            totalLessons: enrollmentData.totalLessons || 0
          };
        })
      );
      
      // Sort by last accessed (most recent first)
      return courseProgressData.sort((a, b) => {
        if (!a.lastAccessed) return 1;
        if (!b.lastAccessed) return -1;
        return b.lastAccessed.seconds - a.lastAccessed.seconds;
      });
    } catch (error) {
      console.error('Error getting user progress overview:', error);
      throw error;
    }
  }

  // Get user achievements
  async getUserAchievements(userId = null) {
    try {
      if (!userId) {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error('No authenticated user');
        }
        userId = currentUser.uid;
      }
      
      const achievementsCollection = collection(db, `UserTasks/${userId}/Achievements`);
      const snapshot = await getDocs(achievementsCollection);
      
      if (snapshot.empty) {
        return [];
      }
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting user achievements:', error);
      throw error;
    }
  }

  // Get user course notes
  async getUserCourseNotes(userId = null, courseId = null) {
    try {
      if (!userId) {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error('No authenticated user');
        }
        userId = currentUser.uid;
      }
      
      if (!courseId) {
        throw new Error('Course ID is required');
      }
      
      const enrollmentId = `${userId}_${courseId}`;
      const enrollmentDoc = await getDoc(doc(db, 'Enrollments', enrollmentId));
      
      if (!enrollmentDoc.exists()) {
        return [];
      }
      
      const enrollmentData = enrollmentDoc.data();
      return enrollmentData.notes || [];
    } catch (error) {
      console.error('Error getting user course notes:', error);
      throw error;
    }
  }

  // Add user course note
  async addUserCourseNote(courseId, lessonId, noteText) {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No authenticated user');
      }
      
      const userId = currentUser.uid;
      const enrollmentId = `${userId}_${courseId}`;
      const enrollmentRef = doc(db, 'Enrollments', enrollmentId);
      
      // Create note
      const note = {
        id: Date.now().toString(),
        lessonId,
        text: noteText,
        createdAt: serverTimestamp()
      };
      
      // Update enrollment document
      await updateDoc(enrollmentRef, {
        notes: arrayUnion(note),
        lastAccessed: serverTimestamp()
      });
      
      return {
        success: true,
        note
      };
    } catch (error) {
      console.error('Error adding user course note:', error);
      throw error;
    }
  }

  // Delete user course note
  async deleteUserCourseNote(courseId, noteId) {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No authenticated user');
      }
      
      const userId = currentUser.uid;
      const enrollmentId = `${userId}_${courseId}`;
      const enrollmentRef = doc(db, 'Enrollments', enrollmentId);
      
      // Get current notes
      const enrollmentDoc = await getDoc(enrollmentRef);
      
      if (!enrollmentDoc.exists()) {
        throw new Error('Enrollment not found');
      }
      
      const enrollmentData = enrollmentDoc.data();
      const notes = enrollmentData.notes || [];
      
      // Find the note
      const noteToDelete = notes.find(note => note.id === noteId);
      
      if (!noteToDelete) {
        throw new Error('Note not found');
      }
      
      // Remove the note (arrayRemove requires exact object match)
      await updateDoc(enrollmentRef, {
        notes: arrayRemove(noteToDelete)
      });
      
      return {
        success: true
      };
    } catch (error) {
      console.error('Error deleting user course note:', error);
      throw error;
    }
  }

  // Get user statistics
  async getUserStatistics(userId = null) {
    try {
      if (!userId) {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error('No authenticated user');
        }
        userId = currentUser.uid;
      }
      
      const statsRef = doc(db, 'UserStats', userId);
      const statsDoc = await getDoc(statsRef);
      
      if (!statsDoc.exists()) {
        // Create empty stats if not exists
        await setDoc(statsRef, {
          userId,
          createdAt: serverTimestamp(),
          coursesEnrolled: 0,
          coursesCompleted: 0,
          totalLessonsCompleted: 0,
          totalTimeSpent: 0,
          averageProgress: 0
        });
        
        return {
          userId,
          coursesEnrolled: 0,
          coursesCompleted: 0,
          totalLessonsCompleted: 0,
          totalTimeSpent: 0,
          averageProgress: 0
        };
      }
      
      return {
        id: statsDoc.id,
        ...statsDoc.data()
      };
    } catch (error) {
      console.error('Error getting user statistics:', error);
      throw error;
    }
  }

  // Update user last active timestamp
  async updateLastActive(userId = null) {
    try {
      if (!userId) {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          return; // Silently exit if no user
        }
        userId = currentUser.uid;
      }
      
      const userRef = doc(db, 'Users', userId);
      await updateDoc(userRef, {
        lastActive: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error updating last active:', error);
      // Don't throw - this is a background operation
      return false;
    }
  }

  // Get admin dashboard statistics
  async getAdminDashboardStats() {
    try {
      // Check if current user is admin
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No authenticated user');
      }
      
      const userDoc = await getDoc(doc(db, 'Users', currentUser.uid));
      
      if (!userDoc.exists() || (userDoc.data().role !== 'admin' && userDoc.data().isAdmin !== true)) {
        throw new Error('Unauthorized: Admin access required');
      }
      
      // Get all users count
      const usersCollection = collection(db, 'Users');
      const usersSnapshot = await getDocs(usersCollection);
      const totalUsers = usersSnapshot.docs.length;
      
      // Get all courses count
      const coursesCollection = collection(db, 'Courses');
      const coursesSnapshot = await getDocs(coursesCollection);
      const totalCourses = coursesSnapshot.docs.length;
      
      // Get total enrollments
      const enrollmentsCollection = collection(db, 'Enrollments');
      const enrollmentsSnapshot = await getDocs(enrollmentsCollection);
      const totalEnrollments = enrollmentsSnapshot.docs.length;
      
      // Calculate completed enrollments
      const completedEnrollments = enrollmentsSnapshot.docs.filter(
        doc => doc.data().isCompleted === true
      ).length;
      
      // Get top courses by enrollment
      const topCoursesQuery = query(
        collection(db, 'Courses'),
        orderBy('enrollmentCount', 'desc'),
        limit(5)
      );
      
      const topCoursesSnapshot = await getDocs(topCoursesQuery);
      const topCourses = topCoursesSnapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title,
        enrollmentCount: doc.data().enrollmentCount || 0,
        categoryId: doc.data().categoryId
      }));
      
      // Get recent enrollments
      const recentEnrollmentsQuery = query(
        collection(db, 'Enrollments'),
        orderBy('enrolledAt', 'desc'),
        limit(10)
      );
      
      const recentEnrollmentsSnapshot = await getDocs(recentEnrollmentsQuery);
      const recentEnrollments = await Promise.all(
        recentEnrollmentsSnapshot.docs.map(async (doc) => {
          const data = doc.data();
          
          // Get user name
          let userName = 'Unknown User';
          try {
            const userDoc = await getDoc(doc(db, 'Users', data.userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              userName = `${userData.FirstName || userData.firstName || ''} ${userData.LastName || userData.lastName || ''}`.trim();
              if (!userName) {
                userName = userData.Email || userData.email || 'Unknown User';
              }
            }
          } catch (error) {
            console.error('Error getting user data:', error);
          }
          
          return {
            id: doc.id,
            courseId: data.courseId,
            courseTitle: data.courseTitle,
            userId: data.userId,
            userName,
            enrolledAt: data.enrolledAt,
            progress: data.progress || 0
          };
        })
      );
      
      return {
        totalUsers,
        totalCourses,
        totalEnrollments,
        completedEnrollments,
        completionRate: totalEnrollments > 0 ? 
          Math.round((completedEnrollments / totalEnrollments) * 100) : 0,
        topCourses,
        recentEnrollments
      };
    } catch (error) {
      console.error('Error getting admin dashboard stats:', error);
      throw error;
    }
  }
}

export default new UserService();